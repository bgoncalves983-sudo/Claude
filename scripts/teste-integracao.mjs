// Teste ponta a ponta contra `wrangler dev` (ENVIRONMENT=dev). Uso: node scripts/teste-integracao.mjs [http://localhost:8787]
const BASE = process.argv[2] ?? "http://localhost:8787";
let falhas = 0, total = 0;
const ok = (cond, msg) => { total++; if (cond) console.log("  ok   " + msg); else { falhas++; console.log("  FALHA " + msg); } };

async function pedir(caminho, { metodo = "GET", corpo, gestor, cookie, semCabecalho } = {}) {
  const h = {};
  if (gestor) h["x-dev-user"] = gestor;
  if (cookie) h["cookie"] = cookie;
  if (corpo) h["content-type"] = "application/json";
  if (metodo !== "GET" && !semCabecalho) h["x-requested-with"] = "frota";
  const r = await fetch(BASE + caminho, { method: metodo, headers: h, body: corpo ? JSON.stringify(corpo) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  const sc = r.headers.get("set-cookie");
  return { s: r.status, j, cookie: sc ? sc.split(";")[0] : null, h: r.headers };
}
const G = "gestor@test.pt";

console.log("Acesso sem autenticacao");
ok((await pedir("/api/veiculos")).s === 401, "sem credenciais: 401");
ok((await pedir("/api/saude")).s === 200, "/api/saude e publica");

console.log("Gestor cria instrutores");
const m = await pedir("/api/utilizadores", { metodo: "POST", gestor: G, corpo: { nome: "Marta Silva", perfil: "instrutor", escola: "Escola Radical" } });
ok(m.s === 201 && m.j.username === "marta.silva", "utilizador sugerido marta.silva");
ok(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/.test(m.j.senhaTemporaria ?? ""), "palavra-passe temporaria gerada");
const m2 = await pedir("/api/utilizadores", { metodo: "POST", gestor: G, corpo: { nome: "Marta Silva", perfil: "instrutor" } });
ok(m2.j.username === "marta.silva2", "segundo homonimo recebe marta.silva2");
const lista = await pedir("/api/utilizadores", { gestor: G });
ok(!JSON.stringify(lista.j).includes("senha_hash") && !JSON.stringify(lista.j).includes("senhaHash"), "a lista nunca devolve hashes");

console.log("Login do instrutor");
const mau = await pedir("/api/auth/login", { metodo: "POST", corpo: { username: "marta.silva", password: "errada-errada" } });
ok(mau.s === 401 && mau.j.erro === "Utilizador ou palavra-passe incorretos.", "palavra-passe errada: 401 e mensagem generica");
const inex = await pedir("/api/auth/login", { metodo: "POST", corpo: { username: "nao.existe", password: "errada-errada" } });
ok(inex.s === 401 && inex.j.erro === mau.j.erro, "utilizador inexistente: mesma mensagem (nao revela contas)");
const gest = await pedir("/api/auth/login", { metodo: "POST", corpo: { username: "gestor", password: "qualquer-coisa" } });
ok(gest.s === 401, "a gestao nao entra por palavra-passe");
const login = await pedir("/api/auth/login", { metodo: "POST", corpo: { username: "marta.silva", password: m.j.senhaTemporaria } });
ok(login.s === 200 && login.j.deveMudarSenha === true && !!login.cookie, "login com a temporaria: sessao criada e pede mudanca");
const ck = login.cookie;

console.log("Primeiro acesso: so pode mudar a palavra-passe");
ok((await pedir("/api/veiculos", { cookie: ck })).j?.codigo === "MUDAR_SENHA", "outras rotas bloqueadas ate mudar");
ok((await pedir("/api/me", { cookie: ck })).s === 200, "/api/me continua disponivel");
ok((await pedir("/api/auth/mudar-senha", { metodo: "POST", cookie: ck, corpo: { atual: m.j.senhaTemporaria, nova: "curta" } })).s === 400, "palavra-passe fraca recusada");
ok((await pedir("/api/auth/mudar-senha", { metodo: "POST", cookie: ck, corpo: { atual: m.j.senhaTemporaria, nova: "marta.silva12345" } })).s === 400, "palavra-passe com o utilizador recusada");
ok((await pedir("/api/auth/mudar-senha", { metodo: "POST", cookie: ck, corpo: { atual: m.j.senhaTemporaria, nova: "cavalo-azul-lua-42" } })).s === 200, "palavra-passe boa aceite");
ok((await pedir("/api/veiculos", { cookie: ck })).s === 200, "depois de mudar, acede normalmente");
ok((await pedir("/api/auth/login", { metodo: "POST", corpo: { username: "marta.silva", password: m.j.senhaTemporaria } })).s === 401, "a temporaria deixou de funcionar");

console.log("Dados e permissoes do instrutor");
const v = await pedir("/api/veiculos", { metodo: "POST", gestor: G, corpo: { matricula: "zz-11-aa", tipo: "ligeiro", categoria: "B", valorAquisicao: 18900, fornecedor: "Auto Norte", cartaoCombustivel: "4471", notas: "interno" } });
ok(v.s === 201, "gestor cria veiculo (" + v.s + ")");
const vid = v.j.id;
ok(((await pedir("/api/veiculos", { cookie: ck })).j ?? []).length === 0, "instrutor sem veiculo atribuido nao ve nenhum");
const eu = (await pedir("/api/me", { cookie: ck })).j;
const pa = await pedir("/api/veiculos/" + vid, { metodo: "PATCH", gestor: G, corpo: { instrutorId: eu.id } });
ok(pa.s === 200, "gestor atribui o veiculo ao instrutor");
const vis = (await pedir("/api/veiculos", { cookie: ck })).j;
ok(vis.length === 1 && vis[0].matricula === "ZZ-11-AA", "instrutor ve so o seu veiculo");
ok(!("valorAquisicao" in vis[0]) && !("fornecedor" in vis[0]) && !("cartaoCombustivel" in vis[0]) && !("notas" in vis[0]) && !("fotoKey" in vis[0]), "sem dados financeiros nem notas internas na resposta");
const vg = (await pedir("/api/veiculos/" + vid, { gestor: G })).j;
ok(vg.valorAquisicao === 18900 && vg.cartaoCombustivel === "4471", "a gestao ve esses dados");
ok((await pedir("/api/utilizadores", { cookie: ck })).s === 403, "instrutor nao lista utilizadores");
ok((await pedir("/api/veiculos", { metodo: "POST", cookie: ck, corpo: { matricula: "xx-00-xx", tipo: "mota" } })).s === 403, "instrutor nao cria veiculos");
ok((await pedir("/api/alertas", { cookie: ck })).s === 403, "instrutor nao ve alertas de gestao");
ok((await pedir("/api/conjuntos", { cookie: ck })).s === 403, "instrutor nao ve conjuntos");

console.log("Protecao contra outros sites e cabecalhos");
ok((await pedir("/api/veiculos", { metodo: "POST", gestor: G, semCabecalho: true, corpo: { matricula: "qq-00-qq", tipo: "mota" } })).s === 403, "alteracao sem o cabecalho da app e recusada");
const r = await fetch(BASE + "/api/saude", { method: "GET", headers: {} });
ok(r.headers.get("x-content-type-options") === "nosniff" && r.headers.get("x-frame-options") === "DENY", "cabecalhos de seguranca presentes");
const csrf = await fetch(BASE + "/api/veiculos", { method: "POST", headers: { "x-dev-user": G, "x-requested-with": "frota", origin: "https://mau.example", "content-type": "application/json" }, body: JSON.stringify({ matricula: "qq-00-qq", tipo: "mota" }) });
ok(csrf.status === 403, "Origin de outro site e recusada");

console.log("Edicao simultanea");
const p1 = await pedir("/api/veiculos/" + vid, { metodo: "PATCH", gestor: G, corpo: { cor: "Branco", versao: vg.versao } });
ok(p1.s === 200, "gravacao com a versao atual passa");
const p2 = await pedir("/api/veiculos/" + vid, { metodo: "PATCH", gestor: G, corpo: { cor: "Preto", versao: vg.versao } });
ok(p2.s === 409, "gravacao com a versao antiga e recusada (409)");

console.log("Bloqueio por tentativas");
let ultimo;
for (let i = 0; i < 5; i++) ultimo = await pedir("/api/auth/login", { metodo: "POST", corpo: { username: "marta.silva2", password: "errada-errada-" + i } });
ok(ultimo.s === 401 && ultimo.j.tentativasRestantes === 0, "5.a falha: sem tentativas restantes");
const bloq = await pedir("/api/auth/login", { metodo: "POST", corpo: { username: "marta.silva2", password: m2.j.senhaTemporaria } });
ok(bloq.s === 429, "conta bloqueada mesmo com a palavra-passe certa (429)");
const l2 = (await pedir("/api/utilizadores", { gestor: G })).j.find((u) => u.username === "marta.silva2");
ok(l2.bloqueado === true, "a gestao ve a conta bloqueada");

console.log("Reposicao e desativacao");
const rep = await pedir("/api/utilizadores/" + l2.id + "/repor-senha", { metodo: "POST", gestor: G });
ok(rep.s === 200 && !!rep.j.senhaTemporaria, "gestor repoe a palavra-passe");
const l3 = await pedir("/api/auth/login", { metodo: "POST", corpo: { username: "marta.silva2", password: rep.j.senhaTemporaria } });
ok(l3.s === 200, "conta desbloqueada com a nova temporaria");
const rep2 = await pedir("/api/utilizadores/" + eu.id + "/repor-senha", { metodo: "POST", gestor: G });
ok((await pedir("/api/me", { cookie: ck })).s === 401, "repor a palavra-passe termina as sessoes antigas");
const novo = await pedir("/api/auth/login", { metodo: "POST", corpo: { username: "marta.silva", password: rep2.j.senhaTemporaria } });
ok((await pedir("/api/utilizadores/" + eu.id, { metodo: "PATCH", gestor: G, corpo: { ativo: false } })).s === 200, "gestor desativa o instrutor");
ok((await pedir("/api/me", { cookie: novo.cookie })).s === 401, "desativar fecha o acesso de imediato");
ok((await pedir("/api/auth/login", { metodo: "POST", corpo: { username: "marta.silva", password: rep2.j.senhaTemporaria } })).s === 401, "conta desativada nao entra");
const eu2 = (await pedir("/api/utilizadores", { gestor: G })).j.find((u) => u.perfil === "gestor");
ok(eu2 && (await pedir("/api/utilizadores/" + eu2.id, { metodo: "PATCH", gestor: G, corpo: { ativo: false } })).s === 422, "ninguem desativa a propria conta");

console.log("Copias de seguranca");
const A = "admin@test.pt";
ok((await pedir("/api/backups", { gestor: G })).s === 403, "um gestor nao ve as copias (so administradores)");
const bk = await pedir("/api/backups", { metodo: "POST", gestor: A });
ok(bk.s === 201 && bk.j.tabelas > 10, "administrador cria uma copia (" + (bk.j?.tabelas ?? "?") + " tabelas)");
const lb = (await pedir("/api/backups", { gestor: A })).j;
ok(Array.isArray(lb) && lb.length >= 1, "a copia aparece na lista");
const dl = await fetch(BASE + "/api/backups/" + lb[0].nome, { headers: { "x-dev-user": A } });
const bytes = new Uint8Array(await dl.arrayBuffer());
ok(dl.status === 200 && bytes[0] === 0x1f && bytes[1] === 0x8b, "o ficheiro descarregado e um gzip valido");
const { gunzipSync } = await import("node:zlib");
const conteudo = JSON.parse(gunzipSync(bytes).toString());
ok(conteudo.tabelas.veiculo.length >= 1 && !("sessao" in conteudo.tabelas) && !("tentativa_login" in conteudo.tabelas), "inclui os dados e exclui sessoes e tentativas de login");
ok(conteudo.tabelas.utilizador.every((u) => u.senha_hash === null), "as palavras-passe nao vao na copia");
ok((await pedir("/api/backups/..%2F..%2Fsegredo.json.gz", { gestor: A })).s !== 200, "nome de ficheiro invalido e recusado");

console.log("\n" + (total - falhas) + "/" + total + " verificacoes passaram" + (falhas ? " — " + falhas + " FALHA(S)" : ""));
process.exit(falhas ? 1 : 0);
