# SDS CRM Online

Versão web gratuita, sem dependências e pronta para publicar no GitHub Pages.

## Executar localmente

Na pasta do projeto:

```powershell
python -m http.server 8080
```

Abra `http://localhost:8080`.

## Publicar gratuitamente

1. Crie um repositório público no GitHub chamado `sds-crm-online`.
2. Envie `index.html`, `styles.css`, `app.js` e `README.md`.
3. Em **Settings > Pages**, escolha a branch `main` e a pasta `/root`.
4. O GitHub fornecerá um endereço público.

O CRM inicia sem login. Os dados importados ficam salvos no navegador com `localStorage`. A planilha padrão do SDS CRM é carregada automaticamente ao abrir o sistema; o botão **Conectar Google Sheets** permite trocar o link. Para funcionar, configure no Google Sheets: **Compartilhar → Qualquer pessoa com o link → Leitor**.

O botão **Conectar Google Agenda** usa a conta Google escolhida por cada pessoa naquele navegador. Assim, cada usuário autoriza a própria agenda e os eventos são criados na agenda principal da conta autorizada. Como o CRM não possui login próprio, essa vinculação é feita por navegador e pela conta Google selecionada, não por um usuário interno do CRM.
