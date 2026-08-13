# Integração do site com o catálogo do ERP

O ERP publica um catálogo seguro e somente para leitura em:

`GET https://crm-cintia-paula-v3-supabase.vercel.app/api/catalogo`

O endpoint permite requisições do site em outro domínio (CORS) e mantém uma cópia em cache por 5 minutos.

## Conteúdo

- `kits`: código, nome, tema, categoria, descrição pública, preço, disponibilidade, foto e composição;
- `estoque`: código, nome, categoria, cor, disponibilidade e foto;
- `composicao`: itens físicos de cada kit, suas quantidades e respectivas fotos.

Dados internos como valor de reposição, localização, observações operacionais e quantidades exatas do estoque não são publicados.

## Exemplo

```js
const resposta = await fetch(
  'https://crm-cintia-paula-v3-supabase.vercel.app/api/catalogo'
)

if (!resposta.ok) throw new Error('Catálogo indisponível')

const catalogo = await resposta.json()

for (const kit of catalogo.kits) {
  console.log(kit.nome, kit.preco, kit.foto_url, kit.disponivel)
}
```

As fotos são URLs públicas do Supabase Storage e podem ser usadas diretamente em elementos `<img>`.
