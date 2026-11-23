# Rota TEA · Saúde suplementar

Site educativo do projeto de extensão "Novas perspectivas sobre a judicialização do autismo" (Curso de Direito, Faculdade Unità), publicado em https://www.rotatea.com.br.

## Como funciona
- Página única e estática (`index.html`), hospedada na Vercel.
- Sem cadastro, login, banco de dados, formulário de contato ou contador de visitas.
- Modelos, Ficha de Acompanhamento, Checklist e "Meus dados" ficam só no navegador de quem usa (localStorage). Os PDFs são gerados no próprio aparelho (jsPDF e AutoTable, com versão fixa e hash de integridade).
- "Baixar cópia" e "Apagar tudo deste aparelho" ficam em Minha área.
- Contato: contato@rotatea.com.br.

## Segurança
Cabeçalhos definidos em `vercel.json`: Content-Security-Policy, X-Frame-Options, Permissions-Policy, Strict-Transport-Security, X-Content-Type-Options e Referrer-Policy.
