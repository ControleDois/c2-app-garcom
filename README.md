# Controle Dois Garçom

App do garçom (mesas, pedidos e fechamento de conta) que conversa com o PDV pela mesma API do Controle Dois.
Um só código para três formas de uso: **site/PWA**, **Android (APK/AAB)** e **iOS (App Store)**, via Capacitor.

## O que faz

- **Mesas**: lista ao vivo das mesas abertas (atualiza sozinha quando o PDV ou outro garçom mexe), abrir mesa por número, filtro "Minhas".
- **Pedido**: cardápio com busca e categorias, quantidade, observação por item, revisão e envio. Cada pedido vai para a mesa e aparece na hora no PDV (`pending_print`).
- **Mesa**: itens consumidos, cancelamento de item com motivo, "Pedir conta" (avisa o caixa), cancelar mesa vazia.
- **Fechamento**: dividir a conta, várias formas de pagamento (dinheiro, débito, crédito, PIX), troco, recebimento parcial ou total. O total fecha a mesa e gera a venda no servidor, igual ao PDV.

Usa as rotas já existentes: `GET /food/sync/pull`, `POST /food/sync`, o evento `food:table:updated` e `GET /food/menu`.

## Desenvolvimento

```bash
npm install
npm run dev      # http://localhost:5177
npm run build
```

`VITE_API_URL` aponta a API (`.env` para dev; `.env.production` para produção).

## Site (PWA)

`npm run build` gera `dist/`. Publique em `garcom.controledois.com.br` (a origem já está liberada no CORS da API).
Em `public/_redirects` há a regra de SPA (`/* /index.html 200`).

## Android (APK / AAB)

Pré-requisitos: Android Studio com JDK 17+.

```bash
npm run cap:sync        # build + copia o site para o app
npm run cap:android     # abre o Android Studio
```

No Android Studio: **Build > Generate Signed Bundle / APK**. O `appId` é `controledois.c2.garcom` (mude em `capacitor.config.ts` antes de publicar, se precisar).

## iOS (App Store)

Pré-requisitos: macOS com Xcode e conta Apple Developer.

```bash
npm run cap:ios         # build + sync + abre o Xcode
```

No Xcode: escolha o time (Signing & Capabilities) e use **Product > Archive**.

## Ícone e splash

Os arquivos em `assets/` (`icon.png` 1024×1024, `splash.png` 2732×2732) são provisórios, gerados a partir do logo.
Troque pelos oficiais e rode `npm run assets` para regenerar Android, iOS e PWA.
