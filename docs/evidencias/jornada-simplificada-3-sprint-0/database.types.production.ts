// Snapshot somente leitura — produção pxhgfyvpzbcjymmnoyuo — 2026-10-07
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acompanhamento_aprovacao_envios: {
        Row: {
          atualizado_em: string
          canal: string
          id: string
          oportunidade_id: string
          provedor_id: string | null
          status: string
          token_hash: string
        }
        Insert: {
          atualizado_em?: string
          canal: string
          id?: string
          oportunidade_id: string
          provedor_id?: string | null
          status: string
          token_hash: string
        }
        Update: {
          atualizado_em?: string
          canal?: string
          id?: string
          oportunidade_id?: string
          provedor_id?: string | null
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "acompanhamento_aprovacao_envios_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      acompanhamento_envios: {
        Row: {
          atualizado_em: string
          canal: string
          id: string
          oportunidade_id: string
          provedor_id: string | null
          status: string
          token_hash: string
        }
        Insert: {
          atualizado_em?: string
          canal: string
          id?: string
          oportunidade_id: string
          provedor_id?: string | null
          status: string
          token_hash: string
        }
        Update: {
          atualizado_em?: string
          canal?: string
          id?: string
          oportunidade_id?: string
          provedor_id?: string | null
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "acompanhamento_envios_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      acompanhamento_links: {
        Row: {
          created_at: string
          expires_at: string
          oportunidade_id: string
          revoked_at: string | null
          token_cifrado: string | null
          token_hash: string
          whatsapp_consentido_em: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          oportunidade_id: string
          revoked_at?: string | null
          token_cifrado?: string | null
          token_hash: string
          whatsapp_consentido_em?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          oportunidade_id?: string
          revoked_at?: string | null
          token_cifrado?: string | null
          token_hash?: string
          whatsapp_consentido_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acompanhamento_links_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: true
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      assinaturas_missao: {
        Row: {
          assinada_em: string
          created_at: string
          empresa_id: string
          etapa: string
          id: string
          metadados: Json
          mime_type: string
          nome_assinante: string
          ordem_servico_id: string
          registrada_por: string | null
          reserva_id: string
          storage_path: string
        }
        Insert: {
          assinada_em?: string
          created_at?: string
          empresa_id: string
          etapa: string
          id?: string
          metadados?: Json
          mime_type?: string
          nome_assinante: string
          ordem_servico_id: string
          registrada_por?: string | null
          reserva_id: string
          storage_path: string
        }
        Update: {
          assinada_em?: string
          created_at?: string
          empresa_id?: string
          etapa?: string
          id?: string
          metadados?: Json
          mime_type?: string
          nome_assinante?: string
          ordem_servico_id?: string
          registrada_por?: string | null
          reserva_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_missao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_missao_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_missao_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_logs: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          empresa_id: string
          entidade: string
          entidade_id: string | null
          id: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          empresa_id: string
          entidade: string
          entidade_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          empresa_id?: string
          entidade?: string
          entidade_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      clausulas_contrato: {
        Row: {
          ativa: boolean | null
          categoria: string | null
          condicao: string | null
          created_at: string | null
          id: string
          obrigatoria: boolean | null
          ordem: number | null
          texto: string
          titulo: string
        }
        Insert: {
          ativa?: boolean | null
          categoria?: string | null
          condicao?: string | null
          created_at?: string | null
          id?: string
          obrigatoria?: boolean | null
          ordem?: number | null
          texto: string
          titulo: string
        }
        Update: {
          ativa?: boolean | null
          categoria?: string | null
          condicao?: string | null
          created_at?: string | null
          id?: string
          obrigatoria?: boolean | null
          ordem?: number | null
          texto?: string
          titulo?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          cpf: string | null
          created_at: string | null
          criado_em: string | null
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          instagram: string | null
          nome: string
          numero: string | null
          observacoes: string | null
          origem: string | null
          rg: string | null
          status: string | null
          telefone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string | null
          criado_em?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          instagram?: string | null
          nome: string
          numero?: string | null
          observacoes?: string | null
          origem?: string | null
          rg?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string | null
          criado_em?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          instagram?: string | null
          nome?: string
          numero?: string | null
          observacoes?: string | null
          origem?: string | null
          rg?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      conferencia_itens: {
        Row: {
          conferencia_id: string
          estoque_id: string | null
          id: string
          item_id: string | null
          observacoes: string | null
          quantidade_conferida: number
          quantidade_danificada: number
          quantidade_faltante: number
          quantidade_prevista: number
        }
        Insert: {
          conferencia_id: string
          estoque_id?: string | null
          id?: string
          item_id?: string | null
          observacoes?: string | null
          quantidade_conferida?: number
          quantidade_danificada?: number
          quantidade_faltante?: number
          quantidade_prevista?: number
        }
        Update: {
          conferencia_id?: string
          estoque_id?: string | null
          id?: string
          item_id?: string | null
          observacoes?: string | null
          quantidade_conferida?: number
          quantidade_danificada?: number
          quantidade_faltante?: number
          quantidade_prevista?: number
        }
        Relationships: [
          {
            foreignKeyName: "conferencia_itens_conferencia_id_fkey"
            columns: ["conferencia_id"]
            isOneToOne: false
            referencedRelation: "conferencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencia_itens_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencia_itens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      conferencias: {
        Row: {
          conferido_em: string | null
          id: string
          observacoes: string | null
          reserva_id: string
          responsavel: string | null
          status: string
          tipo: string
        }
        Insert: {
          conferido_em?: string | null
          id?: string
          observacoes?: string | null
          reserva_id: string
          responsavel?: string | null
          status?: string
          tipo: string
        }
        Update: {
          conferido_em?: string | null
          id?: string
          observacoes?: string | null
          reserva_id?: string
          responsavel?: string | null
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "conferencias_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_pagamento: {
        Row: {
          id: boolean
          instrucoes: string | null
          link_pagamento: string | null
          pix_beneficiario: string | null
          pix_chave: string | null
          pix_cidade: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          instrucoes?: string | null
          link_pagamento?: string | null
          pix_beneficiario?: string | null
          pix_chave?: string | null
          pix_cidade?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          instrucoes?: string | null
          link_pagamento?: string | null
          pix_beneficiario?: string | null
          pix_chave?: string | null
          pix_cidade?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      consolidacao_estoque_v3_v6: {
        Row: {
          criado_em: string
          estoque_v3_id: string
          estoque_v6_id: string
        }
        Insert: {
          criado_em?: string
          estoque_v3_id: string
          estoque_v6_id: string
        }
        Update: {
          criado_em?: string
          estoque_v3_id?: string
          estoque_v6_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consolidacao_estoque_v3_v6_estoque_v3_id_fkey"
            columns: ["estoque_v3_id"]
            isOneToOne: true
            referencedRelation: "estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consolidacao_estoque_v3_v6_estoque_v6_id_fkey"
            columns: ["estoque_v6_id"]
            isOneToOne: true
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_versoes: {
        Row: {
          conteudo: string
          contrato_id: string | null
          created_at: string | null
          id: string
          status: string | null
          versao: number
        }
        Insert: {
          conteudo: string
          contrato_id?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          versao?: number
        }
        Update: {
          conteudo?: string
          contrato_id?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_versoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          assinado_em: string | null
          assinado_por: string | null
          assinatura_aceite: boolean
          assinatura_documento: string | null
          assinatura_ip_hash: string | null
          assinatura_user_agent: string | null
          created_at: string | null
          criado_em: string | null
          email_destino: string | null
          email_enviado_em: string | null
          email_erro: string | null
          id: string
          numero_contrato: string
          observacoes: string | null
          pdf_url: string | null
          public_token: string
          reserva_id: string | null
          status: string | null
        }
        Insert: {
          assinado_em?: string | null
          assinado_por?: string | null
          assinatura_aceite?: boolean
          assinatura_documento?: string | null
          assinatura_ip_hash?: string | null
          assinatura_user_agent?: string | null
          created_at?: string | null
          criado_em?: string | null
          email_destino?: string | null
          email_enviado_em?: string | null
          email_erro?: string | null
          id?: string
          numero_contrato: string
          observacoes?: string | null
          pdf_url?: string | null
          public_token?: string
          reserva_id?: string | null
          status?: string | null
        }
        Update: {
          assinado_em?: string | null
          assinado_por?: string | null
          assinatura_aceite?: boolean
          assinatura_documento?: string | null
          assinatura_ip_hash?: string | null
          assinatura_user_agent?: string | null
          created_at?: string | null
          criado_em?: string | null
          email_destino?: string | null
          email_enviado_em?: string | null
          email_erro?: string | null
          id?: string
          numero_contrato?: string
          observacoes?: string | null
          pdf_url?: string | null
          public_token?: string
          reserva_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas: {
        Row: {
          categoria: string | null
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          status: string | null
          valor: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          status?: string | null
          valor?: number
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          status?: string | null
          valor?: number
        }
        Relationships: []
      }
      empresas: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          configuracoes: Json | null
          contrato_padrao: string | null
          cor_principal: string | null
          created_at: string | null
          email: string | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logo_url: string | null
          logradouro: string | null
          nome: string
          nome_fantasia: string | null
          numero: string | null
          plano: string | null
          razao_social: string | null
          site: string | null
          status: string
          telefone: string | null
          updated_at: string | null
          updated_by: string | null
          whatsapp: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          configuracoes?: Json | null
          contrato_padrao?: string | null
          cor_principal?: string | null
          created_at?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logo_url?: string | null
          logradouro?: string | null
          nome: string
          nome_fantasia?: string | null
          numero?: string | null
          plano?: string | null
          razao_social?: string | null
          site?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string | null
          updated_by?: string | null
          whatsapp?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          configuracoes?: Json | null
          contrato_padrao?: string | null
          cor_principal?: string | null
          created_at?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logo_url?: string | null
          logradouro?: string | null
          nome?: string
          nome_fantasia?: string | null
          numero?: string | null
          plano?: string | null
          razao_social?: string | null
          site?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string | null
          updated_by?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      equipe: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          especialidades: string | null
          funcao: string | null
          id: string
          nome: string
          observacoes: string | null
          possui_veiculo: boolean | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          especialidades?: string | null
          funcao?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          possui_veiculo?: boolean | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          especialidades?: string | null
          funcao?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          possui_veiculo?: boolean | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      estoque: {
        Row: {
          categoria: string
          codigo: string
          cor: string | null
          criado_em: string | null
          foto_url: string | null
          id: string
          item: string
          quantidade_manutencao: number | null
          quantidade_total: number | null
          status: string | null
          valor_reposicao: number | null
        }
        Insert: {
          categoria: string
          codigo: string
          cor?: string | null
          criado_em?: string | null
          foto_url?: string | null
          id?: string
          item: string
          quantidade_manutencao?: number | null
          quantidade_total?: number | null
          status?: string | null
          valor_reposicao?: number | null
        }
        Update: {
          categoria?: string
          codigo?: string
          cor?: string | null
          criado_em?: string | null
          foto_url?: string | null
          id?: string
          item?: string
          quantidade_manutencao?: number | null
          quantidade_total?: number | null
          status?: string | null
          valor_reposicao?: number | null
        }
        Relationships: []
      }
      estoque_itens: {
        Row: {
          categoria: string | null
          codigo: string | null
          cor: string | null
          created_at: string | null
          foto_url: string | null
          id: string
          localizacao: string | null
          nome: string
          observacoes: string | null
          quantidade_disponivel: number | null
          quantidade_manutencao: number | null
          quantidade_total: number | null
          status: string | null
          valor_locacao: number | null
          valor_reposicao: number | null
        }
        Insert: {
          categoria?: string | null
          codigo?: string | null
          cor?: string | null
          created_at?: string | null
          foto_url?: string | null
          id?: string
          localizacao?: string | null
          nome: string
          observacoes?: string | null
          quantidade_disponivel?: number | null
          quantidade_manutencao?: number | null
          quantidade_total?: number | null
          status?: string | null
          valor_locacao?: number | null
          valor_reposicao?: number | null
        }
        Update: {
          categoria?: string | null
          codigo?: string | null
          cor?: string | null
          created_at?: string | null
          foto_url?: string | null
          id?: string
          localizacao?: string | null
          nome?: string
          observacoes?: string | null
          quantidade_disponivel?: number | null
          quantidade_manutencao?: number | null
          quantidade_total?: number | null
          status?: string | null
          valor_locacao?: number | null
          valor_reposicao?: number | null
        }
        Relationships: []
      }
      evidencias_missao: {
        Row: {
          capturada_em: string
          created_at: string
          criada_por: string | null
          descricao: string | null
          empresa_id: string
          etapa: string
          id: string
          metadados: Json
          mime_type: string
          ordem_servico_id: string
          reserva_id: string
          storage_path: string
          tamanho_bytes: number
          tipo: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          capturada_em?: string
          created_at?: string
          criada_por?: string | null
          descricao?: string | null
          empresa_id: string
          etapa: string
          id?: string
          metadados?: Json
          mime_type: string
          ordem_servico_id: string
          reserva_id: string
          storage_path: string
          tamanho_bytes?: number
          tipo?: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          capturada_em?: string
          created_at?: string
          criada_por?: string | null
          descricao?: string | null
          empresa_id?: string
          etapa?: string
          id?: string
          metadados?: Json
          mime_type?: string
          ordem_servico_id?: string
          reserva_id?: string
          storage_path?: string
          tamanho_bytes?: number
          tipo?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidencias_missao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidencias_missao_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidencias_missao_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      feedbacks: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          impacto: string
          mensagem: string
          navegador: string | null
          pagina: string | null
          prioridade: string
          resolvido_em: string | null
          resposta: string | null
          status: string
          tipo: string
          updated_at: string
          url: string | null
          usuario_id: string | null
          versao_app: string | null
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          impacto?: string
          mensagem: string
          navegador?: string | null
          pagina?: string | null
          prioridade?: string
          resolvido_em?: string | null
          resposta?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          url?: string | null
          usuario_id?: string | null
          versao_app?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          impacto?: string
          mensagem?: string
          navegador?: string | null
          pagina?: string | null
          prioridade?: string
          resolvido_em?: string | null
          resposta?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          url?: string | null
          usuario_id?: string | null
          versao_app?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_composicao: {
        Row: {
          created_at: string | null
          id: string
          item_id: string | null
          kit_id: string | null
          observacoes: string | null
          quantidade: number | null
          valor_ajuste: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id?: string | null
          kit_id?: string | null
          observacoes?: string | null
          quantidade?: number | null
          valor_ajuste?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string | null
          kit_id?: string | null
          observacoes?: string | null
          quantidade?: number | null
          valor_ajuste?: number
        }
        Relationships: [
          {
            foreignKeyName: "kit_composicao_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_composicao_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_itens: {
        Row: {
          created_at: string | null
          estoque_id: string | null
          id: string
          item_id: string | null
          kit_id: string | null
          observacoes: string | null
          quantidade: number
        }
        Insert: {
          created_at?: string | null
          estoque_id?: string | null
          id?: string
          item_id?: string | null
          kit_id?: string | null
          observacoes?: string | null
          quantidade?: number
        }
        Update: {
          created_at?: string | null
          estoque_id?: string | null
          id?: string
          item_id?: string | null
          kit_id?: string | null
          observacoes?: string | null
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "kit_itens_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_itens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_itens_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
        ]
      }
      kits: {
        Row: {
          categoria: string | null
          codigo: string
          created_at: string | null
          criado_em: string | null
          descricao: string | null
          foto_url: string | null
          id: string
          nome: string
          observacoes: string | null
          quantidade: number | null
          status: string | null
          tema: string | null
          tema_id: string | null
          valor: number | null
          valor_base: number | null
          valor_fim_semana: number | null
        }
        Insert: {
          categoria?: string | null
          codigo: string
          created_at?: string | null
          criado_em?: string | null
          descricao?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          quantidade?: number | null
          status?: string | null
          tema?: string | null
          tema_id?: string | null
          valor?: number | null
          valor_base?: number | null
          valor_fim_semana?: number | null
        }
        Update: {
          categoria?: string | null
          codigo?: string
          created_at?: string | null
          criado_em?: string | null
          descricao?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          quantidade?: number | null
          status?: string | null
          tema?: string | null
          tema_id?: string | null
          valor?: number | null
          valor_base?: number | null
          valor_fim_semana?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kits_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "temas"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_financeiros: {
        Row: {
          categoria: string | null
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          forma_pagamento: string | null
          id: string
          link_pagamento: string | null
          observacoes: string | null
          provedor_atualizado_em: string | null
          provedor_pagamento: string | null
          provedor_pagamento_id: string | null
          provedor_preferencia_id: string | null
          reserva_id: string | null
          status: string | null
          status_detalhe_provedor: string | null
          status_provedor: string | null
          tipo: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          forma_pagamento?: string | null
          id?: string
          link_pagamento?: string | null
          observacoes?: string | null
          provedor_atualizado_em?: string | null
          provedor_pagamento?: string | null
          provedor_pagamento_id?: string | null
          provedor_preferencia_id?: string | null
          reserva_id?: string | null
          status?: string | null
          status_detalhe_provedor?: string | null
          status_provedor?: string | null
          tipo: string
          valor?: number
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          link_pagamento?: string | null
          observacoes?: string | null
          provedor_atualizado_em?: string | null
          provedor_pagamento?: string | null
          provedor_pagamento_id?: string | null
          provedor_preferencia_id?: string | null
          reserva_id?: string | null
          status?: string | null
          status_detalhe_provedor?: string | null
          status_provedor?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_financeiros_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      modelo_clausulas: {
        Row: {
          clausula_id: string | null
          created_at: string | null
          id: string
          modelo_id: string | null
          obrigatoria: boolean | null
          ordem: number | null
        }
        Insert: {
          clausula_id?: string | null
          created_at?: string | null
          id?: string
          modelo_id?: string | null
          obrigatoria?: boolean | null
          ordem?: number | null
        }
        Update: {
          clausula_id?: string | null
          created_at?: string | null
          id?: string
          modelo_id?: string | null
          obrigatoria?: boolean | null
          ordem?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "modelo_clausulas_clausula_id_fkey"
            columns: ["clausula_id"]
            isOneToOne: false
            referencedRelation: "clausulas_contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelo_clausulas_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos_contrato"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos_contrato: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          tipo_evento: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          tipo_evento?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          tipo_evento?: string | null
        }
        Relationships: []
      }
      movimentos_estoque: {
        Row: {
          conferencia_id: string | null
          criado_em: string
          estoque_id: string | null
          id: string
          item_id: string | null
          observacoes: string | null
          quantidade: number
          saldo_manutencao_antes: number
          saldo_manutencao_depois: number
          saldo_total_antes: number
          saldo_total_depois: number
          tipo: string
        }
        Insert: {
          conferencia_id?: string | null
          criado_em?: string
          estoque_id?: string | null
          id?: string
          item_id?: string | null
          observacoes?: string | null
          quantidade: number
          saldo_manutencao_antes: number
          saldo_manutencao_depois: number
          saldo_total_antes: number
          saldo_total_depois: number
          tipo: string
        }
        Update: {
          conferencia_id?: string | null
          criado_em?: string
          estoque_id?: string | null
          id?: string
          item_id?: string | null
          observacoes?: string | null
          quantidade?: number
          saldo_manutencao_antes?: number
          saldo_manutencao_depois?: number
          saldo_total_antes?: number
          saldo_total_depois?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentos_estoque_conferencia_id_fkey"
            columns: ["conferencia_id"]
            isOneToOne: false
            referencedRelation: "conferencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_estoque_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_estoque_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencias_missao: {
        Row: {
          atualizada_por: string | null
          created_at: string
          criada_por: string | null
          descricao: string
          empresa_id: string
          etapa: string
          id: string
          ordem_servico_id: string
          prioridade: string
          reserva_id: string
          resolucao: string | null
          resolvida_em: string | null
          resolvida_por: string | null
          responsavel_usuario_id: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          atualizada_por?: string | null
          created_at?: string
          criada_por?: string | null
          descricao: string
          empresa_id: string
          etapa: string
          id?: string
          ordem_servico_id: string
          prioridade?: string
          reserva_id: string
          resolucao?: string | null
          resolvida_em?: string | null
          resolvida_por?: string | null
          responsavel_usuario_id?: string | null
          status?: string
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          atualizada_por?: string | null
          created_at?: string
          criada_por?: string | null
          descricao?: string
          empresa_id?: string
          etapa?: string
          id?: string
          ordem_servico_id?: string
          prioridade?: string
          reserva_id?: string
          resolucao?: string | null
          resolvida_em?: string | null
          resolvida_por?: string | null
          responsavel_usuario_id?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_missao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_missao_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_missao_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencias_missao_fotos: {
        Row: {
          created_at: string
          criada_por: string | null
          empresa_id: string
          id: string
          mime_type: string
          ocorrencia_id: string
          storage_path: string
          tamanho_bytes: number
        }
        Insert: {
          created_at?: string
          criada_por?: string | null
          empresa_id: string
          id?: string
          mime_type: string
          ocorrencia_id: string
          storage_path: string
          tamanho_bytes?: number
        }
        Update: {
          created_at?: string
          criada_por?: string | null
          empresa_id?: string
          id?: string
          mime_type?: string
          ocorrencia_id?: string
          storage_path?: string
          tamanho_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_missao_fotos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_missao_fotos_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "ocorrencias_missao"
            referencedColumns: ["id"]
          },
        ]
      }
      oportunidade_historico: {
        Row: {
          created_at: string
          descricao: string
          etapa_anterior: string | null
          etapa_nova: string | null
          id: string
          oportunidade_id: string
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          descricao: string
          etapa_anterior?: string | null
          etapa_nova?: string | null
          id?: string
          oportunidade_id: string
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string
          etapa_anterior?: string | null
          etapa_nova?: string | null
          id?: string
          oportunidade_id?: string
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oportunidade_historico_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      oportunidade_itens: {
        Row: {
          created_at: string
          empresa_id: string
          estoque_item_id: string | null
          id: string
          kit_id: string | null
          nome_snapshot: string
          observacoes: string | null
          oportunidade_id: string
          ordem: number
          quantidade: number
          tipo: string
          updated_at: string
          valor_referencia: number | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          estoque_item_id?: string | null
          id?: string
          kit_id?: string | null
          nome_snapshot: string
          observacoes?: string | null
          oportunidade_id: string
          ordem?: number
          quantidade?: number
          tipo: string
          updated_at?: string
          valor_referencia?: number | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          estoque_item_id?: string | null
          id?: string
          kit_id?: string | null
          nome_snapshot?: string
          observacoes?: string | null
          oportunidade_id?: string
          ordem?: number
          quantidade?: number
          tipo?: string
          updated_at?: string
          valor_referencia?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "oportunidade_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidade_itens_estoque_item_id_fkey"
            columns: ["estoque_item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidade_itens_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidade_itens_oportunidade_empresa_fkey"
            columns: ["oportunidade_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id", "empresa_id"]
          },
        ]
      }
      oportunidades: {
        Row: {
          cadastro_completo_em: string | null
          celular: string
          cliente_id: string | null
          created_at: string
          created_by: string | null
          data_evento: string | null
          desconto_calculado: number
          desconto_tipo: string
          desconto_valor: number
          email: string | null
          empresa_id: string | null
          etapa: string
          id: string
          interesse: string | null
          motivo_perda: string | null
          nome_contato: string
          numero: number
          observacoes: string | null
          origem: string
          origem_externa_id: string | null
          proximo_contato: string | null
          quantidade_convidados: number | null
          recebida_em: string
          responsavel_id: string | null
          updated_at: string
          valor_estimado: number
          versao: number
        }
        Insert: {
          cadastro_completo_em?: string | null
          celular: string
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_evento?: string | null
          desconto_calculado?: number
          desconto_tipo?: string
          desconto_valor?: number
          email?: string | null
          empresa_id?: string | null
          etapa?: string
          id?: string
          interesse?: string | null
          motivo_perda?: string | null
          nome_contato: string
          numero?: number
          observacoes?: string | null
          origem?: string
          origem_externa_id?: string | null
          proximo_contato?: string | null
          quantidade_convidados?: number | null
          recebida_em?: string
          responsavel_id?: string | null
          updated_at?: string
          valor_estimado?: number
          versao?: number
        }
        Update: {
          cadastro_completo_em?: string | null
          celular?: string
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_evento?: string | null
          desconto_calculado?: number
          desconto_tipo?: string
          desconto_valor?: number
          email?: string | null
          empresa_id?: string | null
          etapa?: string
          id?: string
          interesse?: string | null
          motivo_perda?: string | null
          nome_contato?: string
          numero?: number
          observacoes?: string | null
          origem?: string
          origem_externa_id?: string | null
          proximo_contato?: string | null
          quantidade_convidados?: number | null
          recebida_em?: string
          responsavel_id?: string | null
          updated_at?: string
          valor_estimado?: number
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "oportunidades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_itens: {
        Row: {
          created_at: string
          descricao: string
          estoque_item_id: string | null
          id: string
          kit_id: string | null
          orcamento_id: string
          quantidade: number
          subtotal: number | null
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          descricao: string
          estoque_item_id?: string | null
          id?: string
          kit_id?: string | null
          orcamento_id: string
          quantidade?: number
          subtotal?: number | null
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          estoque_item_id?: string | null
          id?: string
          kit_id?: string | null
          orcamento_id?: string
          quantidade?: number
          subtotal?: number | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_estoque_item_id_fkey"
            columns: ["estoque_item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          acrescimos: number
          cliente_id: string | null
          contrato_assinado_em: string | null
          contrato_id: string | null
          created_at: string
          created_by: string | null
          dados_cliente_completos_em: string | null
          data_devolucao: string | null
          data_evento: string | null
          data_retirada: string | null
          desconto: number
          email_destino: string | null
          email_enviado_em: string | null
          email_erro: string | null
          empresa_id: string | null
          endereco_evento: string | null
          formalizacao_bloqueio: string | null
          formalizacao_status: string | null
          formalizado_em: string | null
          frete: number
          hold_expira_em: string | null
          horario_evento: string | null
          horario_retirada: string | null
          id: string
          lancamento_sinal_id: string | null
          numero: number
          observacoes: string | null
          oportunidade_id: string | null
          public_token: string
          reserva_id: string | null
          respondido_em: string | null
          respondido_por: string | null
          resposta_cliente: string | null
          resposta_observacao: string | null
          sinal_pago_em: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          validade: string | null
          valor_sinal_formalizacao: number | null
          vencimento_sinal: string | null
          versao: number
        }
        Insert: {
          acrescimos?: number
          cliente_id?: string | null
          contrato_assinado_em?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          dados_cliente_completos_em?: string | null
          data_devolucao?: string | null
          data_evento?: string | null
          data_retirada?: string | null
          desconto?: number
          email_destino?: string | null
          email_enviado_em?: string | null
          email_erro?: string | null
          empresa_id?: string | null
          endereco_evento?: string | null
          formalizacao_bloqueio?: string | null
          formalizacao_status?: string | null
          formalizado_em?: string | null
          frete?: number
          hold_expira_em?: string | null
          horario_evento?: string | null
          horario_retirada?: string | null
          id?: string
          lancamento_sinal_id?: string | null
          numero?: number
          observacoes?: string | null
          oportunidade_id?: string | null
          public_token?: string
          reserva_id?: string | null
          respondido_em?: string | null
          respondido_por?: string | null
          resposta_cliente?: string | null
          resposta_observacao?: string | null
          sinal_pago_em?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          validade?: string | null
          valor_sinal_formalizacao?: number | null
          vencimento_sinal?: string | null
          versao?: number
        }
        Update: {
          acrescimos?: number
          cliente_id?: string | null
          contrato_assinado_em?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          dados_cliente_completos_em?: string | null
          data_devolucao?: string | null
          data_evento?: string | null
          data_retirada?: string | null
          desconto?: number
          email_destino?: string | null
          email_enviado_em?: string | null
          email_erro?: string | null
          empresa_id?: string | null
          endereco_evento?: string | null
          formalizacao_bloqueio?: string | null
          formalizacao_status?: string | null
          formalizado_em?: string | null
          frete?: number
          hold_expira_em?: string | null
          horario_evento?: string | null
          horario_retirada?: string | null
          id?: string
          lancamento_sinal_id?: string | null
          numero?: number
          observacoes?: string | null
          oportunidade_id?: string | null
          public_token?: string
          reserva_id?: string | null
          respondido_em?: string | null
          respondido_por?: string | null
          resposta_cliente?: string | null
          resposta_observacao?: string | null
          sinal_pago_em?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          validade?: string | null
          valor_sinal_formalizacao?: number | null
          vencimento_sinal?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_lancamento_sinal_id_fkey"
            columns: ["lancamento_sinal_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_financeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      ordem_servico_equipe: {
        Row: {
          colaborador_id: string
          created_at: string | null
          funcao_na_os: string | null
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          observacoes: string | null
          ordem_servico_id: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string | null
          funcao_na_os?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          observacoes?: string | null
          ordem_servico_id: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string | null
          funcao_na_os?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          observacoes?: string | null
          ordem_servico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordem_servico_equipe_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_servico_equipe_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      ordem_servico_itens: {
        Row: {
          concluida_em: string | null
          concluida_por: string | null
          concluido: boolean | null
          created_at: string | null
          descricao: string
          etapa: string
          id: string
          obrigatoria: boolean | null
          ordem_servico_id: string | null
          updated_at: string | null
        }
        Insert: {
          concluida_em?: string | null
          concluida_por?: string | null
          concluido?: boolean | null
          created_at?: string | null
          descricao: string
          etapa: string
          id?: string
          obrigatoria?: boolean | null
          ordem_servico_id?: string | null
          updated_at?: string | null
        }
        Update: {
          concluida_em?: string | null
          concluida_por?: string | null
          concluido?: boolean | null
          created_at?: string | null
          descricao?: string
          etapa?: string
          id?: string
          obrigatoria?: boolean | null
          ordem_servico_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordem_servico_itens_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          cliente_nome: string | null
          concluida_em: string | null
          created_at: string | null
          data_prevista: string | null
          data_retirada: string | null
          etapa_atual: string | null
          horario_retirada: string | null
          id: string
          iniciada_em: string | null
          numero: string
          observacoes: string | null
          reserva_id: string | null
          responsavel: string | null
          status: string | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          cliente_nome?: string | null
          concluida_em?: string | null
          created_at?: string | null
          data_prevista?: string | null
          data_retirada?: string | null
          etapa_atual?: string | null
          horario_retirada?: string | null
          id?: string
          iniciada_em?: string | null
          numero: string
          observacoes?: string | null
          reserva_id?: string | null
          responsavel?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          cliente_nome?: string | null
          concluida_em?: string | null
          created_at?: string | null
          data_prevista?: string | null
          data_retirada?: string | null
          etapa_atual?: string | null
          horario_retirada?: string | null
          id?: string
          iniciada_em?: string | null
          numero?: string
          observacoes?: string | null
          reserva_id?: string | null
          responsavel?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamento_webhook_eventos: {
        Row: {
          acao: string
          created_at: string
          erro: string | null
          external_reference: string | null
          id: string
          pagamento_id: string
          processado_em: string | null
          provedor: string
          request_id: string | null
          status: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          erro?: string | null
          external_reference?: string | null
          id?: string
          pagamento_id: string
          processado_em?: string | null
          provedor: string
          request_id?: string | null
          status?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          erro?: string | null
          external_reference?: string | null
          id?: string
          pagamento_id?: string
          processado_em?: string | null
          provedor?: string
          request_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
          criado_em: string | null
          data_pagamento: string
          forma: string | null
          id: string
          observacoes: string | null
          reserva_id: string | null
          valor: number
        }
        Insert: {
          criado_em?: string | null
          data_pagamento: string
          forma?: string | null
          id?: string
          observacoes?: string | null
          reserva_id?: string | null
          valor: number
        }
        Update: {
          criado_em?: string | null
          data_pagamento?: string
          forma?: string | null
          id?: string
          observacoes?: string | null
          reserva_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_reserva_rate_limits: {
        Row: {
          chave_hash: string
          empresa_id: string
          janela_inicio: string
          requisicoes: number
          updated_at: string
        }
        Insert: {
          chave_hash: string
          empresa_id: string
          janela_inicio: string
          requisicoes?: number
          updated_at?: string
        }
        Update: {
          chave_hash?: string
          empresa_id?: string
          janela_inicio?: string
          requisicoes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_reserva_rate_limits_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      recebimentos: {
        Row: {
          created_at: string | null
          data_recebimento: string | null
          forma_pagamento: string | null
          id: string
          lancamento_id: string | null
          observacoes: string | null
          reserva_id: string | null
          status: string | null
          valor: number
        }
        Insert: {
          created_at?: string | null
          data_recebimento?: string | null
          forma_pagamento?: string | null
          id?: string
          lancamento_id?: string | null
          observacoes?: string | null
          reserva_id?: string | null
          status?: string | null
          valor?: number
        }
        Update: {
          created_at?: string | null
          data_recebimento?: string | null
          forma_pagamento?: string | null
          id?: string
          lancamento_id?: string | null
          observacoes?: string | null
          reserva_id?: string | null
          status?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_financeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      reserva_checklist: {
        Row: {
          concluido: boolean | null
          created_at: string | null
          etapa: string
          id: string
          item: string
          observacoes: string | null
          reserva_id: string | null
          updated_at: string | null
        }
        Insert: {
          concluido?: boolean | null
          created_at?: string | null
          etapa: string
          id?: string
          item: string
          observacoes?: string | null
          reserva_id?: string | null
          updated_at?: string | null
        }
        Update: {
          concluido?: boolean | null
          created_at?: string | null
          etapa?: string
          id?: string
          item?: string
          observacoes?: string | null
          reserva_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reserva_checklist_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      reserva_itens: {
        Row: {
          created_at: string
          descricao: string
          estoque_item_id: string | null
          id: string
          kit_composicao_id: string | null
          kit_id: string | null
          ordem: number
          quantidade: number
          reserva_id: string
          subtotal: number | null
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          descricao: string
          estoque_item_id?: string | null
          id?: string
          kit_composicao_id?: string | null
          kit_id?: string | null
          ordem?: number
          quantidade?: number
          reserva_id: string
          subtotal?: number | null
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          estoque_item_id?: string | null
          id?: string
          kit_composicao_id?: string | null
          kit_id?: string | null
          ordem?: number
          quantidade?: number
          reserva_id?: string
          subtotal?: number | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "reserva_itens_estoque_item_id_fkey"
            columns: ["estoque_item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserva_itens_kit_composicao_id_fkey"
            columns: ["kit_composicao_id"]
            isOneToOne: false
            referencedRelation: "kit_composicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserva_itens_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserva_itens_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      reserva_logistica: {
        Row: {
          created_at: string | null
          etapa: string
          horario_previsto: string | null
          horario_realizado: string | null
          id: string
          observacoes: string | null
          reserva_id: string | null
          responsavel: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          etapa: string
          horario_previsto?: string | null
          horario_realizado?: string | null
          id?: string
          observacoes?: string | null
          reserva_id?: string | null
          responsavel?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          etapa?: string
          horario_previsto?: string | null
          horario_realizado?: string | null
          id?: string
          observacoes?: string | null
          reserva_id?: string | null
          responsavel?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reserva_logistica_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      reserva_timeline: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          reserva_id: string | null
          tipo: string | null
          titulo: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          reserva_id?: string | null
          tipo?: string | null
          titulo: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          reserva_id?: string | null
          tipo?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "reserva_timeline_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      reservas: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          criado_em: string | null
          data_devolucao: string | null
          data_evento: string | null
          data_festa: string | null
          data_pagamento_final: string | null
          data_pagamento_sinal: string | null
          data_retirada: string | null
          desconto: number | null
          endereco_evento: string | null
          entrada: number | null
          forma_pagamento: string | null
          forma_pagamento_final: string | null
          forma_pagamento_sinal: string | null
          horario_evento: string | null
          horario_retirada: string | null
          id: string
          kit_id: string | null
          numero: string | null
          observacoes: string | null
          orcamento_id: string | null
          saldo: number | null
          status: string | null
          status_comercial: string | null
          status_operacional: string | null
          status_pagamento: string | null
          valor_sinal: number | null
          valor_total: number | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          criado_em?: string | null
          data_devolucao?: string | null
          data_evento?: string | null
          data_festa?: string | null
          data_pagamento_final?: string | null
          data_pagamento_sinal?: string | null
          data_retirada?: string | null
          desconto?: number | null
          endereco_evento?: string | null
          entrada?: number | null
          forma_pagamento?: string | null
          forma_pagamento_final?: string | null
          forma_pagamento_sinal?: string | null
          horario_evento?: string | null
          horario_retirada?: string | null
          id?: string
          kit_id?: string | null
          numero?: string | null
          observacoes?: string | null
          orcamento_id?: string | null
          saldo?: number | null
          status?: string | null
          status_comercial?: string | null
          status_operacional?: string | null
          status_pagamento?: string | null
          valor_sinal?: number | null
          valor_total?: number | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          criado_em?: string | null
          data_devolucao?: string | null
          data_evento?: string | null
          data_festa?: string | null
          data_pagamento_final?: string | null
          data_pagamento_sinal?: string | null
          data_retirada?: string | null
          desconto?: number | null
          endereco_evento?: string | null
          entrada?: number | null
          forma_pagamento?: string | null
          forma_pagamento_final?: string | null
          forma_pagamento_sinal?: string | null
          horario_evento?: string | null
          horario_retirada?: string | null
          id?: string
          kit_id?: string | null
          numero?: string | null
          observacoes?: string | null
          orcamento_id?: string | null
          saldo?: number | null
          status?: string | null
          status_comercial?: string | null
          status_operacional?: string | null
          status_pagamento?: string | null
          valor_sinal?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reservas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      site_pre_reservas: {
        Row: {
          caucao: number
          codigo: string
          cpf: string | null
          created_at: string
          data_festa: string
          email: string
          id: string
          kit_id: string
          nome: string
          origem: string
          status: string
          updated_at: string
          valor_kit: number
          whatsapp: string
        }
        Insert: {
          caucao?: number
          codigo: string
          cpf?: string | null
          created_at?: string
          data_festa: string
          email: string
          id?: string
          kit_id: string
          nome: string
          origem?: string
          status?: string
          updated_at?: string
          valor_kit: number
          whatsapp: string
        }
        Update: {
          caucao?: number
          codigo?: string
          cpf?: string | null
          created_at?: string
          data_festa?: string
          email?: string
          id?: string
          kit_id?: string
          nome?: string
          origem?: string
          status?: string
          updated_at?: string
          valor_kit?: number
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_pre_reservas_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
        ]
      }
      temas: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          cor_predominante: string | null
          criado_em: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          cor_predominante?: string | null
          criado_em?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          cor_predominante?: string | null
          criado_em?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      timeline_global: {
        Row: {
          created_at: string
          descricao: string | null
          empresa_id: string | null
          entidade_id: string | null
          entidade_tipo: string
          evento_codigo: string | null
          id: string
          metadados: Json
          modulo: string
          origem: string
          reserva_id: string | null
          status: string | null
          titulo: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          entidade_id?: string | null
          entidade_tipo?: string
          evento_codigo?: string | null
          id?: string
          metadados?: Json
          modulo?: string
          origem?: string
          reserva_id?: string | null
          status?: string | null
          titulo: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          entidade_id?: string | null
          entidade_tipo?: string
          evento_codigo?: string | null
          id?: string
          metadados?: Json
          modulo?: string
          origem?: string
          reserva_id?: string | null
          status?: string | null
          titulo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_global_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_global_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_empresa: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          empresa_id: string
          id: string
          nome: string | null
          perfil: string | null
          updated_at: string
          updated_by: string | null
          usuario_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          empresa_id: string
          id?: string
          nome?: string | null
          perfil?: string | null
          updated_at?: string
          updated_by?: string | null
          usuario_id: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          nome?: string | null
          perfil?: string | null
          updated_at?: string
          updated_by?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_empresa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_acoes: {
        Row: {
          acao: string
          created_at: string | null
          erro: string | null
          evento_id: string | null
          executado_em: string | null
          id: string
          modulo: string
          reserva_id: string | null
          status: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          erro?: string | null
          evento_id?: string | null
          executado_em?: string | null
          id?: string
          modulo: string
          reserva_id?: string | null
          status?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          erro?: string | null
          evento_id?: string | null
          executado_em?: string | null
          id?: string
          modulo?: string
          reserva_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_acoes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "workflow_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_acoes_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_eventos: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          origem: string | null
          reserva_id: string | null
          status_anterior: string | null
          status_novo: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          origem?: string | null
          reserva_id?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          origem?: string | null
          reserva_id?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_eventos_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_regras: {
        Row: {
          acao: string
          ativo: boolean | null
          condicao: string | null
          created_at: string | null
          evento: string
          id: string
          modulo: string
          nome: string
          ordem: number | null
          updated_at: string | null
        }
        Insert: {
          acao: string
          ativo?: boolean | null
          condicao?: string | null
          created_at?: string | null
          evento: string
          id?: string
          modulo: string
          nome: string
          ordem?: number | null
          updated_at?: string | null
        }
        Update: {
          acao?: string
          ativo?: boolean | null
          condicao?: string | null
          created_at?: string | null
          evento?: string
          id?: string
          modulo?: string
          nome?: string
          ordem?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ajustar_valores_pre_reserva_servidor: {
        Args: {
          p_desconto_tipo: string
          p_desconto_valor: number
          p_empresa_id: string
          p_oportunidade_id: string
          p_usuario_id: string
          p_versao_esperada: number
        }
        Returns: Json
      }
      aprovar_orcamento_e_criar_reserva: {
        Args: { p_orcamento_id: string }
        Returns: Json
      }
      cancelar_envio_proposta_servidor: {
        Args: {
          p_empresa_id: string
          p_orcamento_id: string
          p_usuario_id: string
        }
        Returns: Json
      }
      completar_cadastro_pre_reserva: {
        Args: { p_dados: Json; p_empresa_id: string; p_token_hash: string }
        Returns: Json
      }
      completar_dados_cliente_proposta_servidor: {
        Args: {
          p_bairro: string
          p_cidade: string
          p_cpf: string
          p_email?: string
          p_endereco: string
          p_token: string
        }
        Returns: Json
      }
      completar_dados_cliente_proposta_v2_servidor: {
        Args: {
          p_bairro: string
          p_cep: string
          p_cidade: string
          p_complemento: string
          p_cpf: string
          p_email?: string
          p_endereco: string
          p_estado: string
          p_numero: string
          p_token: string
        }
        Returns: Json
      }
      composicao_reserva: {
        Args: { p_reserva_id: string }
        Returns: {
          item_id: string
          quantidade: number
        }[]
      }
      conciliar_pagamento_mercado_pago: {
        Args: {
          p_forma_pagamento: string
          p_lancamento_id: string
          p_pagamento_id: string
          p_pago_em?: string
          p_status: string
          p_status_detalhe: string
          p_valor: number
        }
        Returns: Json
      }
      confirmar_assinatura_formalizacao: {
        Args: { p_orcamento_id: string }
        Returns: Json
      }
      confirmar_pagamento_sinal_formalizacao: {
        Args: { p_forma_pagamento: string; p_orcamento_id: string }
        Returns: Json
      }
      consumir_limite_pre_reserva_servidor: {
        Args: {
          p_chave_hash: string
          p_empresa_id: string
          p_janela_segundos: number
          p_limite: number
        }
        Returns: boolean
      }
      criar_pre_reserva_servidor: {
        Args: {
          p_celular: string
          p_cliente_id: string
          p_data_evento: string
          p_email: string
          p_empresa_id: string
          p_interesse: string
          p_itens: Json
          p_nome_contato: string
          p_origem: string
          p_origem_externa_id: string
          p_usuario_id: string
        }
        Returns: Json
      }
      criar_pre_reserva_site: {
        Args: {
          p_caucao?: number
          p_cpf?: string
          p_data_festa: string
          p_email: string
          p_kit_id: string
          p_nome: string
          p_valor_kit?: number
          p_whatsapp: string
        }
        Returns: Json
      }
      enviar_proposta_servidor: {
        Args: {
          p_empresa_id: string
          p_orcamento_id: string
          p_usuario_id: string
        }
        Returns: Json
      }
      executar_formalizacao_servidor: {
        Args: {
          p_acao: string
          p_forma_pagamento?: string
          p_orcamento_id: string
          p_usuario_id: string
          p_valor_sinal?: number
          p_vencimento?: string
        }
        Returns: Json
      }
      formalizar_orcamento_aprovado: {
        Args: {
          p_orcamento_id: string
          p_valor_sinal: number
          p_vencimento: string
        }
        Returns: Json
      }
      garantir_administrador_inicial: { Args: never; Returns: boolean }
      meu_acesso: { Args: never; Returns: Json }
      proximo_numero_reserva: { Args: never; Returns: string }
      quantidade_estoque_comprometida: {
        Args: {
          p_estoque_item_id: string
          p_fim: string
          p_inicio: string
          p_reserva_ignorar?: string
        }
        Returns: number
      }
      registrar_assinatura_publica_contrato: {
        Args: {
          p_documento: string
          p_ip_hash?: string
          p_nome: string
          p_token: string
          p_user_agent?: string
        }
        Returns: Json
      }
      registrar_conferencia: {
        Args: {
          p_itens: Json
          p_observacoes: string
          p_reserva_id: string
          p_responsavel: string
          p_tipo: string
        }
        Returns: string
      }
      registrar_preferencia_mercado_pago: {
        Args: {
          p_lancamento_id: string
          p_link_pagamento: string
          p_preferencia_id: string
        }
        Returns: Json
      }
      registrar_resposta_publica_orcamento: {
        Args: {
          p_decisao: string
          p_nome: string
          p_observacao?: string
          p_token: string
        }
        Returns: Json
      }
      salvar_reserva_com_itens: {
        Args: {
          p_cliente_id: string
          p_data_evento: string
          p_endereco_evento: string
          p_horario_evento: string
          p_itens: Json
          p_observacoes: string
          p_reserva_id: string
          p_status: string
          p_valor_sinal: number
        }
        Returns: string
      }
      tentar_confirmar_reserva_formalizada: {
        Args: { p_orcamento_id: string }
        Returns: Json
      }
      transicionar_pre_reserva_servidor: {
        Args: {
          p_empresa_id: string
          p_observacao: string
          p_oportunidade_id: string
          p_proximo_status: string
          p_usuario_id: string
          p_versao_esperada: number
        }
        Returns: Json
      }
      usuario_eh_admin_empresa: {
        Args: { p_empresa_id: string }
        Returns: boolean
      }
      usuario_eh_administrador: { Args: never; Returns: boolean }
      usuario_pertence_empresa: {
        Args: { p_empresa_id: string }
        Returns: boolean
      }
      usuario_tem_perfil: { Args: { p_perfis: string[] }; Returns: boolean }
      usuario_tem_perfil_na_empresa: {
        Args: { p_empresa_id: string; p_perfis: string[] }
        Returns: boolean
      }
      usuario_tem_permissao: { Args: { p_modulo: string }; Returns: boolean }
      verificar_disponibilidade_estoque_item: {
        Args: {
          p_estoque_item_id: string
          p_fim: string
          p_inicio: string
          p_quantidade: number
          p_reserva_ignorar?: string
        }
        Returns: Json
      }
      verificar_disponibilidade_kit: {
        Args: {
          p_fim: string
          p_inicio: string
          p_kit_id: string
          p_reserva_ignorar?: string
        }
        Returns: Json
      }
      verificar_disponibilidade_kit_com_hold: {
        Args: {
          p_fim: string
          p_inicio: string
          p_kit_id: string
          p_orcamento_ignorar: string
          p_reserva_ignorar: string
        }
        Returns: Json
      }
      verificar_disponibilidade_orcamento_confirmacao: {
        Args: { p_orcamento_id: string; p_reserva_ignorar?: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
