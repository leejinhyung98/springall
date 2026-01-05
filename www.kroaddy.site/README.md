This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## 카카오맵 가격 정보 표시 기능

Neon DB에 저장된 크롤링 데이터를 카카오맵에 표시하여 메뉴와 가격 정보를 확인할 수 있습니다.

### 환경 변수 설정

`.env.local` 파일을 생성하고 다음을 설정하세요:

```env
NEXT_PUBLIC_KAKAO_MAP_API_KEY=your_kakao_map_javascript_api_key
NEXT_PUBLIC_CRAWLER_API_URL=http://localhost:9001
```

자세한 설정 방법은 [PRICE_INFO_SETUP.md](./PRICE_INFO_SETUP.md)를 참고하세요.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
