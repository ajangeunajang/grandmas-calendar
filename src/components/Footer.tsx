const SITE_URL = "https://www.ajangeunajang.com/";

/** ©, ☞ 같은 특수문자는 모노스페이스에서 깨지므로 기본 폰트로 */
function SymbolText({ children }: { children: React.ReactNode }) {
  return <span className="font-symbol">{children}</span>;
}

export default function Footer({ title }: { title: string }) {
  return (
    <footer className="mt-auto flex flex-col gap-0.5 pt-3 text-sm text-zinc-500">
      <p>
        <SymbolText>©</SymbolText> {new Date().getFullYear()}. {title}. All rights reserved.
      </p>
      <p>
        Inquiries <SymbolText>☞</SymbolText> ajangeunajang@gmail.com
      </p>
      <p>
        Design and Developed by{" "}
        <a
          href={SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="border-b border-dotted border-current pb-px hover:text-zinc-900 dark:hover:text-white"
        >
          Euna Jang
        </a>
      </p>
    </footer>
  );
}
