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

  rm -rf "$DAILY_DIR" "$WEEKLY_DIR"
  mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"

  export PATH="$FAKE_BIN:$PATH"
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
  else
    assert "$(echo "$out" | grep -c RUN_FAIL)" "1" "$label: run_backup retorna falha"
    assert "$gz_count" "0" "$label: NAO publica dump nenhum"
    assert "$(echo "$out" | grep -c 'concluido')" "0" "$label: NAO imprime concluido"
    assert "$(echo "$out" | grep -c 'FALHOU o dump')" "1" "$label: avisa falha do dump"
  fi
}

run_case "pg_dump ok" 0
run_case "pg_dump falha (status 1, stdout vazio)" 1

if [ "$fail" = "0" ]; then
  echo "TODOS OS CASOS PASSARAM"
else
  echo "HA CASOS FALHOS" >&2
  exit 1
fi
