# Rota TEA

Plataforma da cartilha Rota TEA (saúde suplementar).

- **Parte pública:** Início, Guia Cidadão, Mapa da Rota, Base jurídica e Fontes.
- **Área da família (com cadastro):** Painel, Meus documentos, Novo documento (4 modelos + Ficha de Acompanhamento), Checklist e Meu cadastro. Documentos com situação (rascunho, pronto, enviado, resposta recebida), salvamento automático e download em PDF.

## Tecnologia
- Site estático (`index.html`), publicado no Vercel.
- Cadastro, login e dados no Supabase (região São Paulo). Estrutura do banco e regras de segurança em `supabase/schema.sql`: cada pessoa só lê e altera os próprios dados (Row Level Security).
- A chave usada no site é a chave pública (publishable) do Supabase; a proteção dos dados é feita pelas regras do banco.
