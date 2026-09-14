#!/bin/sh
# Backup diario: dump do Postgres + tar das fotos de produto, com retencao e
# envio opcional para armazenamento fora do servidor via rclone.
#
# ponytail: loop com sleep em vez de cron daemon -- e um container de vida
# longa, "rodar 1x por dia" nao precisa de mais do que isso.
set -eu

DAILY_DIR="${DAILY_DIR:-/backup/daily}"
WEEKLY_DIR="${WEEKLY_DIR:-/backup/weekly}"
RETENTION_DAILY="${RETENTION_DAILY:-7}"
RETENTION_WEEKLY="${RETENTION_WEEKLY:-4}"
UPLOADS_DIR="${UPLOADS_DIR:-/uploads}"

mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"

run_backup() {
  stamp=$(date +%Y%m%d_%H%M%S)
  weekday=$(date +%u) # 7 = domingo

  echo "[backup] $stamp: iniciando dump do Postgres"
  # JON-52 (Auditoria 360): `pg_dump | gzip > arquivo` com `sh` (dash, sem
  # pipefail) reporta o status do GZIP, nao do pg_dump -- gzip engole stdin
  # vazio/truncado e sai 0 mesmo com o dump tendo falhado (erro de auth,
  # conexao caindo no meio), entao o script seguia pra retencao/rclone/
  # "concluido" com um .sql.gz inutil. Dump pra arquivo pra checar o status
  # dele isoladamente antes de compactar.
  db_tmp="$DAILY_DIR/db_${stamp}.sql"
  if ! PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h db -U postgres -d antenor_db > "$db_tmp"; then
    echo "[backup] $stamp: FALHOU o dump do Postgres" >&2
    rm -f "$db_tmp"
    return 1
  fi
  if ! gzip "$db_tmp"; then
    echo "[backup] $stamp: FALHOU ao compactar o dump" >&2
    rm -f "$db_tmp" "$db_tmp.gz"
    return 1
  fi

  echo "[backup] $stamp: compactando fotos de produto"
  if ! tar czf "$DAILY_DIR/uploads_${stamp}.tar.gz" -C "$UPLOADS_DIR" .; then
    echo "[backup] $stamp: FALHOU o tar dos uploads" >&2
    return 1
  fi

  # Domingo: guarda uma copia na pasta semanal, retida mais tempo.
  if [ "$weekday" = "7" ]; then
    cp "$DAILY_DIR/db_${stamp}.sql.gz" "$WEEKLY_DIR/"
    cp "$DAILY_DIR/uploads_${stamp}.tar.gz" "$WEEKLY_DIR/"
  fi

  # Retencao: apaga o que passou da janela configurada.
  find "$DAILY_DIR" -type f -mtime "+${RETENTION_DAILY}" -delete
  find "$WEEKLY_DIR" -type f -mtime "+$((RETENTION_WEEKLY * 7))" -delete

  if [ -n "${RCLONE_REMOTE:-}" ]; then
    echo "[backup] $stamp: enviando para $RCLONE_REMOTE"
    rclone sync "$DAILY_DIR" "$RCLONE_REMOTE/daily" --config /config/rclone/rclone.conf || \
      echo "[backup] $stamp: envio remoto falhou, backup local preservado" >&2
    rclone sync "$WEEKLY_DIR" "$RCLONE_REMOTE/weekly" --config /config/rclone/rclone.conf || true
  else
    echo "[backup] $stamp: RCLONE_REMOTE nao configurado -- backup so local. Ver docs/deploy.md."
  fi

  echo "[backup] $stamp: concluido"
}

# BACKUP_LOOP=0 (usado por backup.test.sh) so define run_backup sem entrar no
# loop -- deixa o teste chamar run_backup direto e checar o resultado.
if [ "${BACKUP_LOOP:-1}" != "0" ]; then
  while true; do
    run_backup || echo "[backup] rodada com falha, tentando de novo na proxima janela"
    sleep 86400
  done
fi
