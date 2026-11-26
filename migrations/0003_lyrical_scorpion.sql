CREATE TABLE `atribuicao` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`veiculo_id` integer NOT NULL,
	`utilizador_id` integer NOT NULL,
	`inicio` text NOT NULL,
	`fim` text,
	FOREIGN KEY (`veiculo_id`) REFERENCES `veiculo`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`utilizador_id`) REFERENCES `utilizador`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `atribuicao_veiculo_idx` ON `atribuicao` (`veiculo_id`);--> statement-breakpoint
CREATE TABLE `deposito` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`combustivel` text DEFAULT 'Gasoleo' NOT NULL,
	`capacidade_l` real NOT NULL,
	`nivel_minimo_l` real DEFAULT 0 NOT NULL,
	`tolerancia_pct` real DEFAULT 1 NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deposito_movimento` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deposito_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`data` text NOT NULL,
	`delta_litros` real NOT NULL,
	`preco_litro` real,
	`fornecedor` text,
	`guia` text,
	`veiculo_id` integer,
	`utilizador_id` integer,
	`abastecimento_id` integer,
	`medido_litros` real,
	`anula_movimento_id` integer,
	`motivo` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`deposito_id`) REFERENCES `deposito`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`veiculo_id`) REFERENCES `veiculo`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`utilizador_id`) REFERENCES `utilizador`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deposito_movimento_abastecimento_id_unique` ON `deposito_movimento` (`abastecimento_id`);--> statement-breakpoint
CREATE INDEX `dep_mov_deposito_idx` ON `deposito_movimento` (`deposito_id`,`data`);--> statement-breakpoint
CREATE TABLE `multa` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`veiculo_id` integer NOT NULL,
	`data` text NOT NULL,
	`auto` text,
	`local` text,
	`valor` real,
	`condutor_id` integer,
	`limite_pagamento` text,
	`estado` text DEFAULT 'por_pagar' NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`veiculo_id`) REFERENCES `veiculo`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`condutor_id`) REFERENCES `utilizador`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `multa_veiculo_idx` ON `multa` (`veiculo_id`);--> statement-breakpoint
CREATE TABLE `sessao` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`utilizador_id` integer NOT NULL,
	`criada_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	`expira_em` text NOT NULL,
	`ultima_utilizacao` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	`dispositivo` text,
	FOREIGN KEY (`utilizador_id`) REFERENCES `utilizador`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessao_token_hash_unique` ON `sessao` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessao_utilizador_idx` ON `sessao` (`utilizador_id`);--> statement-breakpoint
CREATE TABLE `sinistro` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`veiculo_id` integer NOT NULL,
	`data` text NOT NULL,
	`descricao` text NOT NULL,
	`condutor_id` integer,
	`participacao` text,
	`estado` text DEFAULT 'aberto' NOT NULL,
	`valor` real,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`veiculo_id`) REFERENCES `veiculo`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`condutor_id`) REFERENCES `utilizador`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sinistro_veiculo_idx` ON `sinistro` (`veiculo_id`);--> statement-breakpoint
CREATE TABLE `tentativa_login` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`ip` text,
	`em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	`sucesso` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tentativa_username_idx` ON `tentativa_login` (`username`,`em`);--> statement-breakpoint
CREATE INDEX `tentativa_ip_idx` ON `tentativa_login` (`ip`,`em`);--> statement-breakpoint
CREATE TABLE `verificacao_diaria` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`veiculo_id` integer NOT NULL,
	`utilizador_id` integer NOT NULL,
	`data` text NOT NULL,
	`resultado` text NOT NULL,
	`itens` text NOT NULL,
	`notas` text,
	`cliente_id` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`veiculo_id`) REFERENCES `veiculo`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`utilizador_id`) REFERENCES `utilizador`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verificacao_diaria_cliente_id_unique` ON `verificacao_diaria` (`cliente_id`);--> statement-breakpoint
CREATE INDEX `verificacao_veiculo_idx` ON `verificacao_diaria` (`veiculo_id`,`data`);--> statement-breakpoint
ALTER TABLE `abastecimento` ADD `horas` real;--> statement-breakpoint
ALTER TABLE `abastecimento` ADD `origem` text DEFAULT 'posto' NOT NULL;--> statement-breakpoint
ALTER TABLE `abastecimento` ADD `deposito_id` integer;--> statement-breakpoint
ALTER TABLE `abastecimento` ADD `cliente_id` text;--> statement-breakpoint
ALTER TABLE `abastecimento` ADD `criado_em` text;--> statement-breakpoint
CREATE UNIQUE INDEX `abastecimento_cliente_id_unique` ON `abastecimento` (`cliente_id`);--> statement-breakpoint
ALTER TABLE `utilizador` ADD `metodo` text DEFAULT 'access' NOT NULL;--> statement-breakpoint
ALTER TABLE `utilizador` ADD `username` text;--> statement-breakpoint
ALTER TABLE `utilizador` ADD `escola` text;--> statement-breakpoint
ALTER TABLE `utilizador` ADD `senha_hash` text;--> statement-breakpoint
ALTER TABLE `utilizador` ADD `deve_mudar_senha` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `utilizador` ADD `senha_temporaria_expira` text;--> statement-breakpoint
ALTER TABLE `utilizador` ADD `senha_alterada_em` text;--> statement-breakpoint
ALTER TABLE `utilizador` ADD `ultimo_acesso` text;--> statement-breakpoint
CREATE UNIQUE INDEX `utilizador_username_unique` ON `utilizador` (`username`);--> statement-breakpoint
ALTER TABLE `veiculo` ADD `versao` integer DEFAULT 1 NOT NULL;