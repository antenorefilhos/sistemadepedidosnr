#!/bin/sh
# Backup diario: dump do Postgres + tar das fotos de produto, com retencao e
# envio opcional para armazenamento fora do servidor via rclone.
#
# ponytail: loop com sleep em vez de cron daemon -- e um container de vida
# longa, "rodar 1x por dia" nao precisa de mais do que isso.
set -eu

DAILY_DIR=/backup/daily
WEEKLY_DIR=/backup/weekly
RETENTION_DAILY="${RETENTION_DAILY:-7}"
RETENTION_WEEKLY="${RETENTION_WEEKLY:-4}"

mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"

run_backup() {
  stamp=$(date +%Y%m%d_%H%M%S)
  weekday=$(date +%u) # 7 = domingo

  echo "[backup] $stamp: iniciando dump do Postgres"
  if ! PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h db -U postgres -d antenor_db \
      | gzip > "$DAILY_DIR/db_${stamp}.sql.gz"; then
    echo "[backup] $stamp: FALHOU o dump do Postgres" >&2
    return 1
  fi

  echo "[backup] $stamp: compactando fotos de produto"
  if ! tar czf "$DAILY_DIR/uploads_${stamp}.tar.gz" -C /uploads .; then
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

while true; do
  run_backup || echo "[backup] rodada com falha, tentando de novo na proxima janela"
  sleep 86400
done
