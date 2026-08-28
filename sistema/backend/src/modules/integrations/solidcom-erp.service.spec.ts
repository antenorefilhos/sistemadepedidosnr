import { SolidcomERPService } from './solidcom-erp.service';

/**
 * `tipoIntegracao` (SEMPRE/NUNCA/ESTOQUE) so vem no GetProdutos, o endpoint do
 * sync completo. O incremental (GetProdutosAlterados, de hora em hora) e o
 * GetProdutosEAN nao mandam esse campo.
 *
 * Enquanto ausente era tratado como ESTOQUE, cada sync incremental
 * sobrescrevia o SEMPRE gravado pelo completo -- e o produto sumia da vitrine
 * (a regra e "SEMPRE, ou ESTOQUE com estoque > 0"). Foi o que tirou o
 * "LIMAO kg" do ar: estoque -95 e syncOption rebaixado pra ESTOQUE.
 */
// O construtor exige estas por `requireEnv`, sem valor embutido -- e' o que
// impede producao de rodar contra o CNPJ/endereco errado calada. Valores
// ficticios aqui de proposito: nenhum teste deste arquivo fala com o ERP.
process.env.SOLIDCOM_API_URL = process.env.SOLIDCOM_API_URL || 'http://erp.invalido:5000';
process.env.SOLIDCOM_CNPJ = process.env.SOLIDCOM_CNPJ || '11111111111111';
process.env.SOLIDCOM_CODECOM = process.env.SOLIDCOM_CODECOM || '1';

describe('SolidcomERPService — syncOption', () => {
  const service = new SolidcomERPService({} as never);
  // normalizeProduct e privado; o teste exercita o caminho real de entrada.
  const normalize = (row: Record<string, unknown>) =>
    (service as unknown as { extractProducts: (data: unknown) => Array<{ syncOption?: string }> })
      .extractProducts([row])[0];

  const baseRow = {
    codigo_ean: 114,
    id_produto: 6019,
    produto: 'LIMAO kg',
    vl_produto: 12.99,
    qtd_produto: -95,
    ativo: true,
  };

  it('le tipoIntegracao quando o ERP manda (GetProdutos)', () => {
    expect(normalize({ ...baseRow, tipoIntegracao: 'SEMPRE' }).syncOption).toBe('SEMPRE');
    expect(normalize({ ...baseRow, tipoIntegracao: 'NUNCA' }).syncOption).toBe('NUNCA');
    expect(normalize({ ...baseRow, tipoIntegracao: 'ESTOQUE' }).syncOption).toBe('ESTOQUE');
  });

  // O caso que causou o bug: sem o campo, o valor tem que ficar indefinido pro
  // upsert preservar o que ja esta no banco, NAO virar ESTOQUE.
  it('deixa syncOption indefinido quando o ERP nao manda o campo', () => {
    expect(normalize(baseRow).syncOption).toBeUndefined();
    expect(normalize({ ...baseRow, tipoIntegracao: '' }).syncOption).toBeUndefined();
    expect(normalize({ ...baseRow, tipoIntegracao: '   ' }).syncOption).toBeUndefined();
  });

  it('valor desconhecido continua caindo em ESTOQUE (default seguro)', () => {
    expect(normalize({ ...baseRow, tipoIntegracao: 'QUALQUER_COISA' }).syncOption).toBe('ESTOQUE');
  });

  it('aceita o alias `internet` e ignora caixa/espacos', () => {
    expect(normalize({ ...baseRow, internet: 'sempre' }).syncOption).toBe('SEMPRE');
    expect(normalize({ ...baseRow, tipoIntegracao: '  NUNCA  ' }).syncOption).toBe('NUNCA');
  });
});
