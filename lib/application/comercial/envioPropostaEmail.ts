/** Validate delivery prerequisites before publishing the proposal. */
export async function executarEnvioPropostaEmail<T>(dependencias: {
  preparar: () => Promise<unknown>
  disponibilizar: () => Promise<unknown>
  enviar: () => Promise<T>
}): Promise<T> {
  await dependencias.preparar()
  await dependencias.disponibilizar()
  return dependencias.enviar()
}
