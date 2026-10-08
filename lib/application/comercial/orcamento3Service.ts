import { publicarEvento } from '@/lib/events/eventBus'
import { orcamento3Repository } from '@/lib/repositories/orcamento3Repository'
import { salvarOrcamento3 as executar } from './orcamento3Application'
import type {
  Orcamento3Salvo,
  SalvarOrcamento3Input
} from './orcamento3.types'

export function salvarOrcamento3(
  input: SalvarOrcamento3Input
): Promise<Orcamento3Salvo> {
  return executar(input, {
    salvar: dados => orcamento3Repository.salvar(dados),
    publicar: publicarEvento
  })
}
