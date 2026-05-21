## Privacy Score (Versão Temporária)

O **Privacy Score** é uma métrica heurística que vai de **0 a 100**:

- **100** → maior respeito à privacidade
- **0** → maior risco à privacidade

A pontuação começa em 100 e sofre descontos sempre que a página apresenta sinais observáveis de rastreamento ou exposição de dados.

### Categorias avaliadas

A análise considera cinco categorias de comportamento da página:

- **Conexões de terceira parte** — requisições feitas para domínios externos
- **Cookies e supercookies** — mecanismos clássicos de identificação
- **Armazenamento local** — uso de `localStorage`, `sessionStorage` e similares
- **Fingerprinting** — técnicas que identificam o usuário pelas características do navegador
- **Hijacking / hooking** — possíveis interceptações de funções ou comportamentos do navegador

### Pesos atribuídos

Cada categoria tem um peso diferente no cálculo final:

- **Peso alto:** *Fingerprinting* e *Third-party tracking*
  > São técnicas persistentes, pouco visíveis ao usuário e difíceis de neutralizar.

- **Peso intermediário:** *Cookies* e *Storage*
  > São mecanismos comuns na web, mas ainda permitem manter estado e correlacionar a navegação.

- **Peso menor (em quantidade), mas com penalidade alta quando detectado:** *Hijacking / hooking*
  > Aparece com menos frequência, porém indica um comportamento potencialmente agressivo.
