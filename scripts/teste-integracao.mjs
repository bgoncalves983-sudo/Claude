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


console.log("Registos: seguros, IUC, IPO, manutencao");
const V2 = await pedir("/api/veiculos", { metodo: "POST", gestor: G, corpo: { matricula: "bb-22-cc", tipo: "pesado", categoria: "C", ipoPeriodicidadeMeses: 24, kmAtuais: 1000 } });
const v2 = V2.j.id;
const b = (cam, o = {}) => pedir(`/api/veiculos/${v2}/${cam}`, o);
ok((await b("seguros", { metodo: "POST", gestor: G, corpo: { seguradora: "X", apolice: "1", dataInicio: "2026-05-01", dataFim: "2026-04-01" } })).s === 422, "seguro com fim antes do inicio recusado");
ok((await b("seguros", { metodo: "POST", gestor: G, corpo: { seguradora: "Fidelidade", apolice: "00-1", premio: 1210, dataInicio: "2026-02-10", dataFim: "2027-02-10" } })).s === 201, "seguro criado");
ok((await b("iuc", { metodo: "POST", gestor: G, corpo: { ano: 2026, valor: 48.2, dataLimite: "2026-12-31" } })).s === 201, "IUC criado");
ok((await b("iuc", { metodo: "POST", gestor: G, corpo: { ano: 2026, dataLimite: "2026-12-31" } })).s === 409, "IUC repetido no mesmo ano recusado");
const ipo = await b("inspecoes", { metodo: "POST", gestor: G, corpo: { data: "2026-03-15", resultado: "aprovado" } });
ok(ipo.j.registo.proximaData === "2028-03-15", "proxima IPO calculada pela periodicidade (24 meses)");
ok((await b("manutencoes", { metodo: "POST", gestor: G, corpo: { tipo: "preventiva", data: "2026-10-02", km: 5000, custo: 312 } })).s === 201, "manutencao criada");
ok((await pedir("/api/veiculos/" + v2, { gestor: G })).j.kmAtuais === 5000, "a manutencao atualiza os quilometros do veiculo");

console.log("Instrutor: abastecimentos, avarias, verificacoes");
const mi = await pedir("/api/utilizadores", { metodo: "POST", gestor: G, corpo: { nome: "Rui Costa", perfil: "instrutor" } });
const li = await pedir("/api/auth/login", { metodo: "POST", corpo: { username: "rui.costa", password: mi.j.senhaTemporaria } });
await pedir("/api/auth/mudar-senha", { metodo: "POST", cookie: li.cookie, corpo: { atual: mi.j.senhaTemporaria, nova: "pao-quente-sol-77" } });
const ck2b = li.cookie; const eur = (await pedir("/api/me", { cookie: ck2b })).j;
await pedir("/api/veiculos/" + v2, { metodo: "PATCH", gestor: G, corpo: { instrutorId: eur.id } });
const I = (cam, o = {}) => pedir(`/api/veiculos/${v2}/${cam}`, { cookie: ck2b, ...o });
ok((await I("seguros")).s === 403 && (await I("manutencoes")).s === 403 && (await I("multas")).s === 403, "instrutor nao ve seguros, manutencao nem multas");
ok((await I("manutencoes", { metodo: "POST", corpo: { tipo: "preventiva", data: "2026-10-02" } })).s === 403, "instrutor nao regista manutencao");
ok((await pedir(`/api/veiculos/${vid}/abastecimentos`, { cookie: ck2b })).s === 404, "instrutor nao acede a veiculo alheio");

console.log("Deposito de gasoleo");
ok((await pedir("/api/deposito", { cookie: ck2b })).s === 403, "instrutor nao ve o deposito");
ok((await pedir("/api/deposito/entradas", { metodo: "POST", gestor: G, corpo: { litros: 20000, precoLitro: 1.46 } })).s === 422, "entrega acima da capacidade recusada");
const ent = await pedir("/api/deposito/entradas", { metodo: "POST", gestor: G, corpo: { litros: 5000, precoLitro: 1.46, fornecedor: "Distribuidora", guia: "2026/1" } });
ok(ent.s === 201 && ent.j.nivelL === 5000 && ent.j.custoMedioLitro === 1.46, "entrada de 5000 l: nivel e custo medio");
const ab = await I("abastecimentos", { metodo: "POST", corpo: { origem: "deposito", litros: 50, km: 5100, clienteId: "abc-123-xyz-1" } });
ok(ab.s === 201 && !("valor" in ab.j.registo) && !("depositoId" in ab.j.registo), "abastecimento do deposito: o instrutor nao recebe valores");
const ab2 = await I("abastecimentos", { metodo: "POST", corpo: { origem: "deposito", litros: 50, km: 5100, clienteId: "abc-123-xyz-1" } });
ok(ab2.s === 200 && ab2.j.repetido === true, "reenvio com o mesmo clienteId nao duplica");
const dep = (await pedir("/api/deposito", { gestor: G })).j;
ok(dep.nivelL === 4950 && dep.percentagem === 50, "nivel do deposito = 4950 l (so uma saida)");
const abg = (await pedir(`/api/veiculos/${v2}/abastecimentos`, { gestor: G })).j[0];
ok(abg.valor === 73 && abg.origem === "deposito", "a gestao ve o custo calculado (50 l x 1,46 = 73 EUR)");
ok((await I("abastecimentos")).j.every((x) => !("valor" in x)), "a lista do instrutor nunca traz valores");
ok((await I("abastecimentos", { metodo: "POST", corpo: { origem: "posto", litros: 30, km: 5200 } })).s === 422, "posto externo exige o valor pago");
const aviso = await I("abastecimentos", { metodo: "POST", corpo: { origem: "posto", litros: 30, valor: 51, km: 100 } });
ok(aviso.s === 201 && /inferiores/.test(aviso.j.aviso ?? ""), "quilometros menores que o ultimo registo: aviso");
const cont = await pedir("/api/deposito/contagens", { metodo: "POST", gestor: G, corpo: { medidoLitros: 4920 } });
ok(cont.j.diferencaL === -30 && cont.j.dentroDaTolerancia === true && cont.j.percentagem === -0.61, "contagem: -30 l (-0,61%) dentro da tolerancia");
ok((await pedir("/api/deposito", { gestor: G })).j.nivelL === 4920, "o ajuste acerta o nivel para 4920 l");
const mov = (await pedir("/api/deposito/movimentos", { gestor: G })).j;
const idEnt = mov.find((m) => m.tipo === "entrada").id;
ok((await pedir(`/api/deposito/movimentos/${idEnt}/anular`, { metodo: "POST", gestor: G, corpo: { motivo: "Lancado por engano" } })).s === 201, "anular uma entrada cria um movimento inverso");
ok((await pedir(`/api/deposito/movimentos/${idEnt}/anular`, { metodo: "POST", gestor: G, corpo: { motivo: "outra vez" } })).s === 422, "nao se anula duas vezes");
ok((await pedir("/api/deposito", { gestor: G })).j.nivelL === -80, "nivel negativo e visivel (4920 - 5000)");

console.log("Avarias e verificacao diaria");
const av = await I("avarias", { metodo: "POST", corpo: { descricao: "Ruido nos travoes", estado: "resolvida" } });
ok(av.s === 201 && av.j.registo.estado === "reportada", "instrutor so reporta: o estado fica 'reportada'");
ok((await I(`avarias/${av.j.registo.id}`, { metodo: "PATCH", corpo: { estado: "resolvida" } })).s === 403, "instrutor nao altera o estado da avaria");
ok((await b(`avarias/${av.j.registo.id}`, { metodo: "PATCH", gestor: G, corpo: { estado: "resolvida" } })).j.dataResolucao !== null, "gestao resolve e fica a data de resolucao");
const vd = await I("verificacoes", { metodo: "POST", corpo: { itens: [{ item: "Pneus", ok: true }, { item: "Travoes", ok: false }], notas: "Pedal mole", clienteId: "verif-0001-aa" } });
ok(vd.s === 201 && vd.j.registo.resultado === "problema" && vd.j.avariaCriada === true, "verificacao com problema cria uma avaria");
ok((await b("avarias", { gestor: G })).j.some((a) => /Verifica/.test(a.descricao)), "a avaria da verificacao aparece para a gestao");

console.log("Fotografia");
const jpeg = (n) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(n).fill(7)]);
const form = (g, m) => { const f = new FormData(); f.append("grande", new Blob([g], { type: "image/jpeg" }), "g.jpg"); f.append("mini", new Blob([m], { type: "image/jpeg" }), "m.jpg"); return f; };
const up = await fetch(BASE + `/api/veiculos/${v2}/foto`, { method: "POST", headers: { "x-dev-user": G, "x-requested-with": "frota" }, body: form(jpeg(2000), jpeg(300)) });
ok(up.status === 200, "gestor carrega foto (grande + miniatura)");
const falso = await fetch(BASE + `/api/veiculos/${v2}/foto`, { method: "POST", headers: { "x-dev-user": G, "x-requested-with": "frota" }, body: form(new TextEncoder().encode("<html>nao sou imagem</html>"), jpeg(100)) });
ok(falso.status === 415, "ficheiro que nao e imagem e recusado (verifica os bytes)");
const fg = await fetch(BASE + `/api/veiculos/${v2}/foto?tam=mini`, { headers: { cookie: ck2b } });
ok(fg.status === 200 && /immutable/.test(fg.headers.get("cache-control") ?? ""), "instrutor ve a foto do seu veiculo, com cache longa");
ok((await fetch(BASE + `/api/veiculos/${vid}/foto`, { headers: { cookie: ck2b } })).status === 404, "instrutor nao ve fotos de veiculos alheios");
const dtoFoto = (await pedir("/api/veiculos/" + v2, { cookie: ck2b })).j;
ok(dtoFoto.temFoto === true && !("fotoKey" in dtoFoto), "a resposta diz que ha foto sem expor a chave interna");

console.log("Operacoes sobre veiculos: atribuicao, lote, abater, importar");
const at = (await pedir(`/api/veiculos/${v2}/atribuicoes`, { gestor: G })).j;
ok(at.length >= 1 && at.some((x) => x.fim === null), "historico de atribuicao guardado (uma em curso)");
const v3 = (await pedir("/api/veiculos", { metodo: "POST", gestor: G, corpo: { matricula: "dd-33-ee", tipo: "ligeiro" } })).j.id;
ok((await pedir("/api/veiculos/lote", { metodo: "POST", gestor: G, corpo: { ids: [v2, v3], alteracoes: { categoria: "B", proprietario: "Escola Patria" } } })).j.alterados === 2, "edicao em lote altera varios veiculos");
ok((await pedir("/api/veiculos/lote", { metodo: "POST", gestor: G, corpo: { ids: [v2, v3], alteracoes: { instrutorId: eur.id } } })).s === 422, "lote nao atribui o mesmo instrutor a varios veiculos");
ok((await pedir("/api/veiculos/lote", { metodo: "POST", cookie: ck2b, corpo: { ids: [v2], alteracoes: { categoria: "B" } } })).s === 403, "instrutor nao usa o lote");
ok((await pedir(`/api/veiculos/${v3}/abater`, { metodo: "POST", gestor: G, corpo: { motivo: "vendido", valorVenda: 4200, comprador: "Auto Norte" } })).s === 200, "abater veiculo");
const abat = (await pedir("/api/veiculos/" + v3, { gestor: G })).j;
ok(abat.estado === "abatido" && abat.dataAbate && /Abatido/.test(abat.notas), "ficou abatido, com data e nota, sem apagar nada");
ok((await pedir(`/api/veiculos/${v3}/reativar`, { metodo: "POST", gestor: G })).s === 200, "reativar veiculo");
const prev = await pedir("/api/veiculos/importar", { metodo: "POST", gestor: G, corpo: { linhas: [
  { matricula: "ii-11-jj", tipo: "Ligeiro", marca: "Renault", dataMatricula: "28/11/2025" }, { matricula: "bb-22-cc", marca: "Atualizada" },
  { matricula: "kk-00-ll", tipo: "foguetao" }, { matricula: "II-11-JJ", tipo: "mota" }, { matricula: "mm-00-nn" } ] } });
ok(prev.j.novos === 1 && prev.j.atualizar === 1 && prev.j.erros === 3, "pre-visualizacao: 1 novo, 1 a atualizar, 3 erros (tipo invalido, repetida, sem tipo)");
ok(!(await pedir("/api/veiculos", { gestor: G })).j.some((x) => x.matricula === "II-11-JJ"), "a pre-visualizacao nao grava nada");
const conf = await pedir("/api/veiculos/importar", { metodo: "POST", gestor: G, corpo: { confirmar: true, linhas: [{ matricula: "ii-11-jj", tipo: "Ligeiro", marca: "Renault", dataMatricula: "28/11/2025" }, { matricula: "bb-22-cc", marca: "Atualizada" }] } });
ok(conf.j.aplicado === true, "importacao confirmada");
const ij = (await pedir("/api/veiculos", { gestor: G })).j.find((x) => x.matricula === "II-11-JJ");
ok(ij && ij.dataMatricula === "2025-11-28" && (await pedir("/api/veiculos/" + v2, { gestor: G })).j.marca === "Atualizada", "novo criado com data convertida; existente atualizado so nos campos preenchidos");

console.log("Documentos");
const fd = (bytes, tipo, nome) => { const f = new FormData(); f.append("file", new Blob([bytes], { type: tipo }), nome); f.append("tipo", "apolice"); f.append("veiculoId", String(v2)); return f; };
const pdf = new TextEncoder().encode("%PDF-1.4 teste de apolice");
const dUp = await fetch(BASE + "/api/documentos", { method: "POST", headers: { "x-dev-user": G, "x-requested-with": "frota" }, body: fd(pdf, "application/pdf", "apolice.pdf") });
ok(dUp.status === 201, "gestor carrega um PDF");
const dMau = await fetch(BASE + "/api/documentos", { method: "POST", headers: { "x-dev-user": G, "x-requested-with": "frota" }, body: fd(new TextEncoder().encode("<script>alert(1)</script>"), "application/pdf", "mau.pdf") });
ok(dMau.status === 415, "HTML disfarçado de PDF e recusado");
const dj = await dUp.json();
const dDown = await fetch(BASE + `/api/documentos/${dj.id}/ficheiro`, { headers: { cookie: ck2b } });
ok(dDown.status === 200 && dDown.headers.get("content-security-policy") === "sandbox", "instrutor abre o documento do seu veiculo (com sandbox)");

console.log("Multas nos prazos");
await b("multas", { metodo: "POST", gestor: G, corpo: { data: "2026-11-12", auto: "7731902", valor: 120, limitePagamento: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10) } });
ok((await pedir("/api/alertas", { gestor: G })).j.some((x) => x.tipo === "multa"), "a multa por pagar aparece nos prazos a atender");


console.log("Instrutor escolhe outro veiculo");
const vA = (await pedir("/api/veiculos", { metodo: "POST", gestor: G, corpo: { matricula: "xa-01-aa", tipo: "ligeiro", categoria: "B" } })).j.id;
const vB = (await pedir("/api/veiculos", { metodo: "POST", gestor: G, corpo: { matricula: "xb-02-bb", tipo: "ligeiro", categoria: "B" } })).j.id;
const vC = (await pedir("/api/veiculos", { metodo: "POST", gestor: G, corpo: { matricula: "xc-03-cc", tipo: "ligeiro", categoria: "B" } })).j.id;
const vOf = (await pedir("/api/veiculos", { metodo: "POST", gestor: G, corpo: { matricula: "xd-04-dd", tipo: "ligeiro", estado: "imobilizado" } })).j.id;
const mt = await pedir("/api/utilizadores", { metodo: "POST", gestor: G, corpo: { nome: "Ana Reis", perfil: "instrutor" } });
const lt = await pedir("/api/auth/login", { metodo: "POST", corpo: { username: "ana.reis", password: mt.j.senhaTemporaria } });
await pedir("/api/auth/mudar-senha", { metodo: "POST", cookie: lt.cookie, corpo: { atual: mt.j.senhaTemporaria, nova: "lua-verde-mar-55" } });
const ckA = lt.cookie; const idA = (await pedir("/api/me", { cookie: ckA })).j.id;
const reg = (vid, o = {}) => pedir(`/api/veiculos/${vid}/avarias`, { metodo: "POST", cookie: ckA, corpo: { descricao: "Teste de outro veiculo" }, ...o });
let pr = (await pedir("/api/veiculos/para-registo", { cookie: ckA })).j;
ok(pr.atribuidos.length === 0 && pr.podeEscolherOutro === true && pr.outros.some((x) => x.matricula === "XA-01-AA"), "sem veiculo atribuido: pode escolher outro (lista de veiculos ativos)");
ok(!pr.outros.some((x) => x.matricula === "XD-04-DD"), "veiculos imobilizados nao aparecem para escolha");
ok(!JSON.stringify(pr).includes("valorAquisicao") && !JSON.stringify(pr).includes("fotoKey"), "a lista para escolha nao traz dados de gestao");
ok((await reg(vA)).s === 201, "regista avaria noutro veiculo (sem atribuicao)");
ok((await reg(vOf)).s === 404, "nao regista num veiculo imobilizado");
ok((await pedir(`/api/veiculos/${vA}/avarias`, { cookie: ckA })).s === 404, "mas nao le o historico desse veiculo");
ok((await pedir(`/api/veiculos/${vA}/seguros`, { cookie: ckA })).s === 403, "nem outros dados do veiculo");
const abOutro = await pedir(`/api/veiculos/${vA}/abastecimentos`, { metodo: "POST", cookie: ckA, corpo: { origem: "posto", litros: 20, valor: 30, km: 100 } });
ok(abOutro.s === 201 && !("valor" in abOutro.j.registo), "abastecimento noutro veiculo aceite, sem valores na resposta");
ok((await pedir(`/api/veiculos/${vA}/seguros`, { metodo: "POST", cookie: ckA, corpo: {} })).s === 403, "so pode registar abastecimento, avaria e verificacao");
await pedir("/api/veiculos/" + vA, { metodo: "PATCH", gestor: G, corpo: { instrutorId: idA } });
pr = (await pedir("/api/veiculos/para-registo", { cookie: ckA })).j;
ok(pr.atribuidos.length === 1 && pr.podeEscolherOutro === true && pr.outros.every((x) => x.matricula !== "XA-01-AA"), "com 1 atribuido: ainda pode escolher outro (e o seu nao repete na lista)");
ok((await reg(vB)).s === 201, "com 1 atribuido regista noutro veiculo");
await pedir("/api/veiculos/" + vB, { metodo: "PATCH", gestor: G, corpo: { instrutorId: idA } });
pr = (await pedir("/api/veiculos/para-registo", { cookie: ckA })).j;
ok(pr.atribuidos.length === 2 && pr.podeEscolherOutro === false && pr.outros.length === 0, "com 2 atribuidos: nao pode escolher outro e nao recebe lista");
ok((await reg(vC)).s === 404, "com 2 atribuidos nao regista num terceiro veiculo");
ok((await reg(vA)).s === 201 && (await reg(vB)).s === 201, "mas regista em qualquer dos seus dois");
ok((await pedir("/api/veiculos/para-registo", { gestor: G })).s === 403, "a gestao nao usa esta lista");

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
