# Extensão de Privacidade e Rastreamento

Extensão para Firefox que detecta e apresenta, em tempo real, os principais vetores de rastreamento e violação de privacidade presentes na navegação web moderna.

## Funcionalidades

* **Domínios de terceira parte:** lista cada domínio externo contactado pela página e o tipo de recurso carregado (script, image, sub_frame, xhr, etc.), com contagem por tipo.
* **Cookies:** diferencia cookies de primeira e terceira parte, de sessão e persistentes, e identifica potenciais vetores de **supercookies** (HSTS e ETag).
* **Web Storage:** inspeciona `localStorage`, `sessionStorage` e `IndexedDB` da página principal e de iframes, mostrando chaves, tamanhos e origem.
* **Fingerprinting:** intercepta chamadas a `Canvas` (`toDataURL`, `getImageData`), `WebGL`/`WebGL2` (`getParameter`, incluindo `WEBGL_debug_renderer_info`) e `AudioContext`/`OfflineAudioContext` (`createOscillator`, `createDynamicsCompressor`).
* **Hijacking / Hooking:** detecta scripts externos, redirecionamentos entre domínios e adulteração de APIs nativas (`fetch`, `history.pushState`, `history.replaceState`).
* **Privacy Score:** pontuação de 0 a 100 calculada a partir dos sinais coletados, com rótulo qualitativo (Crítico / Ruim / Moderado / Bom).

## Requisitos

* Firefox 109 ou superior.
* Extensão escrita em **Manifest V2** (suporte mantido pelo Firefox).

## Instalação (modo desenvolvedor)

A extensão ainda não está publicada na loja de add-ons. Para testá-la localmente:

1. Clone o repositório:

bash

```bash
git clone https://github.com/felipequeirox/TecHack_Roteiro4.git
```

2. Abra o Firefox e acesse `about:debugging#/runtime/this-firefox`.
3. Clique em **"Carregar extensão temporária…"** ( *Load Temporary Add-on…* ).
4. Selecione o arquivo `manifest.json` na raiz do projeto.
5. A extensão aparecerá listada e o ícone será adicionado à barra de ferramentas.

> Extensões temporárias são removidas ao fechar o Firefox. 

## Uso

1. Navegue até qualquer página HTTP/HTTPS.
2. Clique no ícone da **Privacy Extension** na barra de ferramentas para abrir o popup.
3. O popup exibe o **Privacy Score** no topo e cinco abas:| Aba                   | Conteúdo                                                                                            |
   | --------------------- | ---------------------------------------------------------------------------------------------------- |
   | **3rd Parties** | Domínios externos contactados, com tipo de recurso e contagem.                                      |
   | **Cookies**     | Lista de cookies com classificação 1ª/3ª parte e sessão/persistente, e supercookies detectados. |
   | **Storage**     | Entradas em `localStorage`,`sessionStorage`e bancos `IndexedDB`.                               |
   | **Fingerprint** | APIs de fingerprinting acessadas, com método, origem e contagem.                                    |
   | **Hijacking**   | Scripts externos, redirecionamentos e adulteração de APIs nativas.                                 |
4. A coleta é por  **aba** : cada aba do navegador tem seu próprio relatório, reiniciado a cada novo carregamento de página.
5. Para obter uma leitura completa, abra a página com o popup fechado e aguarde o carregamento terminar antes de abri-lo.

---

## Privacy Score

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
  >
- **Peso intermediário:** *Cookies* e *Storage*

  > São mecanismos comuns na web, mas ainda permitem manter estado e correlacionar a navegação.
  >
- **Peso menor (em quantidade), mas com penalidade alta quando detectado:** *Hijacking / hooking*

  > Aparece com menos frequência, porém indica um comportamento potencialmente agressivo.
  >
