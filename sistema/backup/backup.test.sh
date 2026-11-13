#!/bin/sh
# JON-52 (Auditoria 360): pg_dump falhando (status != 0, stdout vazio) nao
# pode publicar dump nem seguir pra retencao/rclone/"concluido" -- era
# exatamente isso que `pg_dump | gzip > arquivo` deixava passar, porque o
# status do pipeline era o do gzip, nao do pg_dump.
set -eu

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

DAILY_DIR="$WORKDIR/daily"
WEEKLY_DIR="$WORKDIR/weekly"
UPLOADS_DIR="$WORKDIR/uploads"
export UPLOADS_DIR
FAKE_BIN="$WORKDIR/bin"
mkdir -p "$DAILY_DIR" "$WEEKLY_DIR" "$UPLOADS_DIR" "$FAKE_BIN"
touch "$UPLOADS_DIR/foto.jpg"

fail=0
assert() {
  if [ "$1" != "$2" ]; then
    echo "FALHOU: $3 (esperado='$2' obtido='$1')" >&2
    fail=1
  else
    echo "ok: $3"
  fi
}

run_case() {
  label="$1"
  pg_dump_exit="$2"

  cat > "$FAKE_BIN/pg_dump" <<EOF
#!/bin/sh
if [ "$pg_dump_exit" = "0" ]; then
  echo "-- dump falso valido"
  exit 0
fi
exit $pg_dump_exit
EOF
  chmod +x "$FAKE_BIN/pg_dump"

  # curl falso: so registra os argumentos (uma linha por chamada, mesmo que o texto
  # do aviso tenha quebra de linha), para checar se o aviso saiu.
  : > "$WORKDIR/curl.log"
  cat > "$FAKE_BIN/curl" <<EOF
#!/bin/sh
echo "\$*" | tr '\n' ' ' >> "$WORKDIR/curl.log"
echo >> "$WORKDIR/curl.log"
exit 0
EOF
  chmod +x "$FAKE_BIN/curl"

  rm -rf "$DAILY_DIR" "$WEEKLY_DIR"
  mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"

  export PATH="$FAKE_BIN:$PATH"
  export TELEGRAM_BOT_TOKEN=token-falso TELEGRAM_CHAT_ID=chat-falso
  export POSTGRES_PASSWORD=x
  export DAILY_DIR WEEKLY_DIR UPLOADS_DIR
  export BACKUP_LOOP=0

  out_file="$WORKDIR/out.txt"
  {
    # shellcheck disable=SC1091
    . "$(dirname "$0")/backup.sh"
    if run_backup; then echo "RUN_OK"; else echo "RUN_FAIL"; fi
  } >"$out_file" 2>&1
  out=$(cat "$out_file")

  echo "--- saida ($label) ---"
  echo "$out"

  gz_count=$(find "$DAILY_DIR" -name 'db_*.sql.gz' 2>/dev/null | wc -l | tr -d ' ')

  if [ "$pg_dump_exit" = "0" ]; then
    assert "$(echo "$out" | grep -c RUN_OK)" "1" "$label: run_backup retorna sucesso"
    assert "$gz_count" "1" "$label: publica exatamente 1 dump .sql.gz"
    assert "$(echo "$out" | grep -c 'concluido')" "1" "$label: imprime concluido"
    assert "$(wc -l < "$WORKDIR/curl.log" | tr -d ' ')" "0" "$label: nao manda aviso no Telegram"
  else
    assert "$(echo "$out" | grep -c RUN_FAIL)" "1" "$label: run_backup retorna falha"
    assert "$gz_count" "0" "$label: NAO publica dump nenhum"
    assert "$(echo "$out" | grep -c 'concluido')" "0" "$label: NAO imprime concluido"
    assert "$(echo "$out" | grep -c 'FALHOU o dump')" "1" "$label: avisa falha do dump"
    assert "$(wc -l < "$WORKDIR/curl.log" | tr -d ' ')" "1" "$label: manda 1 aviso no Telegram"
    assert "$(grep -c 'api.telegram.org/bottoken-falso/sendMessage' "$WORKDIR/curl.log")" "1" "$label: aviso vai para o endpoint do bot"
    assert "$(grep -c 'não consegui copiar o banco de dados' "$WORKDIR/curl.log")" "1" "$label: aviso em linguagem clara, sem termo tecnico"
    assert "$(grep -c 'Nenhuma cópia nova foi feita hoje' "$WORKDIR/curl.log")" "1" "$label: aviso diz o que aconteceu com a copia"
  fi
}

run_case "pg_dump ok" 0
run_case "pg_dump falha (status 1, stdout vazio)" 1

# Envio ao remoto: o diario NAO leva o tar das fotos (so o dump do banco, ~11 MB);
# o semanal leva tudo. Sem isso o Drive de 15 GiB enche (13/11/2026: 9,9 GiB).
run_remote_case() {
  : > "$WORKDIR/rclone.log"
  cat > "$FAKE_BIN/pg_dump" <<EOF
#!/bin/sh
echo "-- dump falso valido"
EOF
  cat > "$FAKE_BIN/rclone" <<EOF
#!/bin/sh
echo "\$*" >> "$WORKDIR/rclone.log"
exit 0
EOF
  chmod +x "$FAKE_BIN/pg_dump" "$FAKE_BIN/rclone"
  rm -rf "$DAILY_DIR" "$WEEKLY_DIR"
  mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"
  out_file="$WORKDIR/out_remote.txt"
  {
    export RCLONE_REMOTE="remoto-falso:bucket"
    # shellcheck disable=SC1091
    . "$(dirname "$0")/backup.sh"
    if run_backup; then echo "RUN_OK"; else echo "RUN_FAIL"; fi
  } >"$out_file" 2>&1
  unset RCLONE_REMOTE
  daily_line=$(grep '/daily' "$WORKDIR/rclone.log" || true)
  weekly_line=$(grep '/weekly' "$WORKDIR/rclone.log" || true)
  assert "$(grep -c RUN_OK "$out_file")" "1" "remoto: run_backup retorna sucesso"
  assert "$(echo "$daily_line" | grep -c "exclude uploads_")" "1" "remoto: o diario NAO envia o tar das fotos"
  assert "$(echo "$weekly_line" | grep -c "exclude")" "0" "remoto: o semanal envia tudo"
  assert "$(wc -l < "$WORKDIR/rclone.log" | tr -d ' ')" "2" "remoto: duas sincronizacoes (diario e semanal)"
}
run_remote_case

# Envio ao Drive falhando: 1 aviso amigavel dizendo que nada se perdeu.
run_remote_fail_case() {
  : > "$WORKDIR/curl.log"
  cat > "$FAKE_BIN/pg_dump" <<EOF
#!/bin/sh
echo "-- dump falso valido"
EOF
  cat > "$FAKE_BIN/rclone" <<EOF
#!/bin/sh
exit 1
EOF
  chmod +x "$FAKE_BIN/pg_dump" "$FAKE_BIN/rclone"
  rm -rf "$DAILY_DIR" "$WEEKLY_DIR"
  mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"
  out_file="$WORKDIR/out_remote_fail.txt"
  {
    export RCLONE_REMOTE="remoto-falso:bucket"
    # shellcheck disable=SC1091
    . "$(dirname "$0")/backup.sh"
    if run_backup; then echo "RUN_OK"; else echo "RUN_FAIL"; fi
  } >"$out_file" 2>&1
  unset RCLONE_REMOTE
  assert "$(wc -l < "$WORKDIR/curl.log" | tr -d ' ')" "1" "envio falho: manda 1 aviso no Telegram"
  assert "$(grep -c 'não consegui enviá-la para o Google Drive' "$WORKDIR/curl.log")" "1" "envio falho: aviso em linguagem clara"
  assert "$(grep -c 'Nada se perdeu' "$WORKDIR/curl.log")" "1" "envio falho: avisa que nada se perdeu"
}
run_remote_fail_case

if [ "$fail" = "0" ]; then
  echo "TODOS OS CASOS PASSARAM"
else
  echo "HA CASOS FALHOS" >&2
  exit 1
fi
