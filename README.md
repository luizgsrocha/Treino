# Treino

Dashboard pessoal para acompanhar a evolução dos treinos, com foco na meta de correr **2.800 metros em 12 minutos**.

## Dashboard publicado

https://luizgsrocha.github.io/Treino/

## Como funciona

O dashboard é montado automaticamente no navegador a partir dos arquivos da pasta `data`. Ao incluir uma atividade, cartões, tabela, filtros e gráficos são recalculados sem editar o HTML.

```text
index.html
assets/
  styles.css
  dashboard.js
data/
  atividades.json
  sono.json
  configuracoes.json
```

- `index.html`: estrutura sem dados ou cálculos fixos;
- `assets/styles.css`: apresentação e responsividade;
- `assets/dashboard.js`: validação, cálculos, filtros e gráficos;
- `data/atividades.json`: fonte única das atividades;
- `data/sono.json`: registros individuais de sono;
- `data/configuracoes.json`: meta, histórico de LTHR e constantes de carga.

## Indicadores automáticos

- TSI diário e acumulado;
- carga móvel de sete dias;
- CTL (fitness), ATL (fadiga) e TSB (forma);
- distância e quantidade de corridas;
- estimativa do melhor desempenho em 12 minutos;
- frequência cardíaca e LTHR histórico;
- médias de sono, quando `sono.json` possuir registros;
- sugestão de próximo treino baseada na forma atual.

Os dias sem atividade são incluídos com carga zero nos cálculos de CTL e ATL. As constantes utilizadas ficam em `data/configuracoes.json`.

## Adicionando uma atividade

Inclua um objeto em `data/atividades.json`. Os campos obrigatórios são `id`, `data`, `categoria`, `atividade` e `duracao`. Distância, frequência cardíaca, intensidade e TSI podem ser `null` quando não estiverem disponíveis.
