# Sistema de Gerenciamento Empresarial

Este projeto é um sistema de gerenciamento empresarial robusto, focado no backend, desenvolvido para otimizar o controle e a administração de um negócio. Ele oferece um conjunto completo de ferramentas para gerenciar operações diárias, desde o controle de estoque e vendas até a gestão de funcionários e relatórios financeiros, tudo com acesso seguro e restrito.

**Funcionalidades Principais**

- Controle de Vendas e Pagamentos: Registro detalhado de transações e formas de pagamento.

- Gestão de Estoque: Cadastro, controle e rastreamento de produtos, com funcionalidades para entrada e saída do estoque.

- Cadastro de Produtos: Registro completo de produtos com informações detalhadas.

- Gestão de Pessoas: Cadastro e controle de funcionários e clientes.

- Controle de Caixa: Monitoramento e registro de todas as movimentações financeiras.

- Geração de Relatórios: Ferramenta para criar relatórios detalhados de vendas, finanças e estoque.

- Controle de Acesso: Sistema de autenticação com e-mail e senha e controle de acesso restrito por função, garantindo que cada funcionário tenha permissões adequadas.

**Tecnologias Utilizadas**

O projeto foi construído com uma arquitetura focada no backend, utilizando as seguintes tecnologias e pacotes:

**Backend:**

- JavaScript: A linguagem principal.

- Node.js & Express: Ambiente de execução e framework para construir a API de forma rápida e eficiente.

- MySQL & SQL: Banco de dados relacional para armazenamento seguro dos dados.

- JSON: Formato para troca de dados entre o servidor e o cliente.

**Autenticação e Segurança:**

- bcrypt: Utilizado para criptografar as senhas de forma segura.

- jsonwebtoken (JWT): Para gerar tokens de autenticação, garantindo a segurança das rotas e a validação do usuário.

- dotenv: Para gerenciar variáveis de ambiente de forma segura e prática.

- cors: Para controlar o acesso à API por diferentes origens (domínios), permitindo a comunicação com o frontend.

**Próximos Passos**

- Melhoria das Funcionalidades: Continuar a otimizar e expandir as funcionalidades existentes, como a geração de relatórios mais dinâmicos.

- Integração com o Frontend: Concluir a comunicação da API com o frontend, que será desenvolvido em um repositório separado.

- Testes: Implementar testes unitários e de integração para garantir a estabilidade do sistema.
