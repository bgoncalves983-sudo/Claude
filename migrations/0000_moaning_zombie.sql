CREATE TABLE `abastecimento` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`veiculo_id` integer NOT NULL,
	`utilizador_id` integer,
	`data` text NOT NULL,
	`litros` real NOT NULL,
	`valor` real NOT NULL,
	`km` integer,
	`posto` text,
	FOREIGN KEY (`veiculo_id`) REFERENCES `veiculo`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`utilizador_id`) REFERENCES `utilizador`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `abastecimento_veiculo_idx` ON `abastecimento` (`veiculo_id`);--> statement-breakpoint
CREATE TABLE `alerta_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chave` text NOT NULL,
	`enviado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alerta_log_chave_unique` ON `alerta_log` (`chave`);--> statement-breakpoint
CREATE TABLE `associacao_conjunto` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trator_id` integer NOT NULL,
	`reboque_id` integer NOT NULL,
	`data_inicio` text NOT NULL,
	`data_fim` text,
	`motivo` text,
	`criado_por` integer,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`trator_id`) REFERENCES `veiculo`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reboque_id`) REFERENCES `veiculo`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`criado_por`) REFERENCES `utilizador`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conjunto_reboque_ativo` ON `associacao_conjunto` (`reboque_id`) WHERE "associacao_conjunto"."data_fim" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `conjunto_trator_ativo` ON `associacao_conjunto` (`trator_id`) WHERE "associacao_conjunto"."data_fim" IS NULL;--> statement-breakpoint
CREATE TABLE `auditoria` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`utilizador_id` integer,
	`acao` text NOT NULL,
	`entidade` text NOT NULL,
	`entidade_id` integer,
	`detalhe` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`utilizador_id`) REFERENCES `utilizador`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `auditoria_entidade_idx` ON `auditoria` (`entidade`,`entidade_id`);--> statement-breakpoint
CREATE TABLE `avaria` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`veiculo_id` integer NOT NULL,
	`reportado_por` integer,
	`descricao` text NOT NULL,
	`estado` text DEFAULT 'reportada' NOT NULL,
	`data_reporte` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	`data_resolucao` text,
	FOREIGN KEY (`veiculo_id`) REFERENCES `veiculo`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reportado_por`) REFERENCES `utilizador`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `avaria_veiculo_idx` ON `avaria` (`veiculo_id`);--> statement-breakpoint
CREATE INDEX `avaria_estado_idx` ON `avaria` (`estado`);--> statement-breakpoint
CREATE TABLE `documento` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`veiculo_id` integer,
	`entidade` text,
	`entidade_id` integer,
	`tipo` text NOT NULL,
	`nome_ficheiro` text NOT NULL,
	`r2_key` text NOT NULL,
	`content_type` text NOT NULL,
	`tamanho` integer NOT NULL,
	`validade` text,
	`versao` integer DEFAULT 1 NOT NULL,
	`carregado_por` integer,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`veiculo_id`) REFERENCES `veiculo`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`carregado_por`) REFERENCES `utilizador`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documento_r2_key_unique` ON `documento` (`r2_key`);--> statement-breakpoint
CREATE INDEX `documento_veiculo_idx` ON `documento` (`veiculo_id`);--> statement-breakpoint
CREATE TABLE `inspecao` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`veiculo_id` integer NOT NULL,
	`data` text NOT NULL,
	`resultado` text NOT NULL,
	`km` integer,
	`centro` text,
	`custo` real,
	`proxima_data` text,
	FOREIGN KEY (`veiculo_id`) REFERENCES `veiculo`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `inspecao_veiculo_idx` ON `inspecao` (`veiculo_id`);--> statement-breakpoint
CREATE TABLE `iuc` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`veiculo_id` integer NOT NULL,
	`ano` integer NOT NULL,
	`valor` real,
	`data_limite` text NOT NULL,
	`pago` integer DEFAULT false NOT NULL,
	`data_pagamento` text,
	FOREIGN KEY (`veiculo_id`) REFERENCES `veiculo`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `iuc_veiculo_ano` ON `iuc` (`veiculo_id`,`ano`);--> statement-breakpoint
CREATE TABLE `manutencao` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`veiculo_id` integer NOT NULL,
	`avaria_id` integer,
	`tipo` text NOT NULL,
	`data` text NOT NULL,
	`km` integer,
	`horas` real,
	`oficina` text,
	`descricao` text,
	`custo` real,
	`proxima_data` text,
	`proximo_km` integer,
	`proximas_horas` real,
	FOREIGN KEY (`veiculo_id`) REFERENCES `veiculo`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`avaria_id`) REFERENCES `avaria`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `manutencao_veiculo_idx` ON `manutencao` (`veiculo_id`);--> statement-breakpoint
CREATE TABLE `seguro` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`veiculo_id` integer NOT NULL,
	`seguradora` text NOT NULL,
	`apolice` text NOT NULL,
	`cobertura` text,
	`premio` real,
	`periodicidade` text,
	`data_inicio` text NOT NULL,
	`data_fim` text NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`veiculo_id`) REFERENCES `veiculo`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `seguro_veiculo_idx` ON `seguro` (`veiculo_id`);--> statement-breakpoint
CREATE TABLE `utilizador` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`nome` text NOT NULL,
	`perfil` text NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`carta_validade` text,
	`licenca_instrutor_validade` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `utilizador_email_unique` ON `utilizador` (`email`);--> statement-breakpoint
CREATE TABLE `veiculo` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`matricula` text NOT NULL,
	`tipo` text NOT NULL,
	`categoria` text,
	`marca` text,
	`modelo` text,
	`vin` text,
	`combustivel` text,
	`data_matricula` text,
	`data_aquisicao` text,
	`estado` text DEFAULT 'ativo' NOT NULL,
	`ensino` integer DEFAULT true NOT NULL,
	`comando_duplo` integer DEFAULT false NOT NULL,
	`peso_bruto` integer,
	`lugares` integer,
	`cilindrada` integer,
	`usa_horas` integer DEFAULT false NOT NULL,
	`km_atuais` integer,
	`horas_atuais` real,
	`iuc_aplicavel` integer DEFAULT true NOT NULL,
	`ipo_periodicidade_meses` integer,
	`seguro_coberto_pelo_trator` integer DEFAULT false NOT NULL,
	`instrutor_id` integer,
	`notas` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`instrutor_id`) REFERENCES `utilizador`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `veiculo_matricula_unique` ON `veiculo` (`matricula`);--> statement-breakpoint
CREATE INDEX `veiculo_tipo_idx` ON `veiculo` (`tipo`);--> statement-breakpoint
CREATE INDEX `veiculo_instrutor_idx` ON `veiculo` (`instrutor_id`);