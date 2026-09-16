# Treino

Dashboard pessoal para acompanhamento da evolução dos treinos, com foco principal no desempenho em corrida.

## 🎯 Objetivo

**Correr 2.800 metros em 12 minutos.**

O projeto reúne o histórico de atividades para acompanhar a evolução até essa meta, permitindo observar distância, duração, frequência cardíaca e carga de treinamento ao longo do tempo.

## 📊 Sobre o projeto

O `dashboard_treino.html` carrega os registros de `data/atividades.json` e apresenta indicadores como:

- distância percorrida;
- duração das atividades;
- frequência cardíaca média e máxima;
- TSI e carga acumulada;
- CTL (fitness);
- ATL (fadiga);
- TSB (forma);
- histórico de corridas, caminhadas, bike, musculação e outros exercícios.

A ideia é manter o histórico atualizado para avaliar a consistência dos treinos, a resposta do condicionamento e a aproximação da meta de **2.800 m em 12 minutos**.

## 🌐 Dashboard publicado

https://luizgsrocha.github.io/Treino/dashboard_treino.html

## 🗂️ Fonte dos dados

As atividades ficam centralizadas em `data/atividades.json`. A tabela e os gráficos de carga, distância e frequência cardíaca são gerados a partir desse arquivo, evitando a repetição dos mesmos dados em vários trechos do dashboard.

Cada atividade possui um identificador, data, categoria, duração e, quando disponíveis, distância, frequência cardíaca, intensidade e TSI.
