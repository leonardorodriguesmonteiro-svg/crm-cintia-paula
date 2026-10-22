import Link from 'next/link'
import { ArrowUpRight, CalendarDays, Heart, Sparkles } from 'lucide-react'
import { HomeKitsDestaque } from '@/components/publico/HomeKitsDestaque'
import { SitePublicoLayout } from '@/components/publico/SitePublicoLayout'

const etapas = [
  ['01', 'Encontre sua inspiração', 'Explore as fotos e escolha o kit que combina com a sua comemoração.'],
  ['02', 'Conte o que imaginou', 'Informe a data e envie seu pedido. Você também pode montar sua própria composição.'],
  ['03', 'Ajuste com a nossa equipe', 'Receba a proposta com os itens, valores e disponibilidade para a sua festa.'],
  ['04', 'Prepare-se para celebrar', 'Complete os dados e acompanhe contrato, pagamento e confirmação pelo seu link.']
]

export default function SiteHomePage() {
  return <SitePublicoLayout>
    <main>
      <section className="brand-hero">
        <div className="brand-hero-grid">
          <div className="brand-hero-copy">
            <p className="brand-eyebrow">Festas com afeto · Rio de Janeiro</p>
            <h1 className="brand-title">A beleza de celebrar <em>do seu jeito.</em></h1>
            <p className="brand-intro">Dos pequenos encontros aos dias inesquecíveis. Encontre a decoração que conta a sua história, com o cuidado da Cintia Paula em cada detalhe.</p>
            <div className="brand-actions">
              <Link href="/site/kits" className="brand-button">Encontrar meu kit <ArrowUpRight size={18} aria-hidden="true" /></Link>
              <Link href="/reservar" className="brand-button brand-button-outline">Montar minha festa</Link>
            </div>
            <p className="brand-tracking">Já fez um pedido? <Link href="/acompanhar">Acompanhe seu orçamento →</Link></p>
          </div>
          <figure className="brand-hero-photo">
            <img src="/brand/decoracao-borboletas.webp" alt="Decoração da Cintia Paula com borboletas, balões em tons de lilás e mesas de fibra natural" width={384} height={512} fetchPriority="high" />
            <figcaption><span>Feito para criar memórias</span><span>Uma composição do nosso catálogo</span></figcaption>
          </figure>
        </div>
      </section>
      <section className="brand-promises" aria-label="Escolha sua decoração">
        {[[Sparkles, 'Seu estilo, sua festa', 'Kits prontos ou uma composição sua.'], [Heart, 'Cuidado em cada escolha', 'Nossa equipe ajuda nos detalhes.'], [CalendarDays, 'Tudo bem combinado', 'Orçamento e agendamento em um só lugar.']].map(([Icone, titulo, texto]) => {
          const Icon = Icone as typeof Heart
          return <div key={String(titulo)}><Icon size={22} strokeWidth={1.4} aria-hidden="true" /><p><strong>{String(titulo)}</strong><span>{String(texto)}</span></p></div>
        })}
      </section>
      <HomeKitsDestaque />
      <section className="brand-story">
        <div className="brand-story-logo"><img src="/brand/cintia-paula.jpg" alt="Cintia Paula Festas e Decorações — transformando momentos em grandes memórias" width={1536} height={1024} loading="lazy" /></div>
        <div><p className="brand-eyebrow">Muito além da decoração</p><h2 className="brand-title">Um cenário bonito.<br /><em>Uma memória para guardar.</em></h2><p>Cores, formas e pequenos detalhes fazem parte de uma grande lembrança. Aqui, você encontra inspirações para aniversários, encontros e celebrações cheias de significado.</p><Link href="/site/sobre" className="brand-text-link">Conheça a Cintia Paula <ArrowUpRight size={17} aria-hidden="true" /></Link></div>
      </section>
      <section className="brand-steps">
        <div className="brand-section-heading"><p className="brand-eyebrow">Simples, do começo à festa</p><h2 className="brand-title">Você imagina.<br /><em>A gente cuida dos detalhes.</em></h2></div>
        <div className="brand-step-grid">{etapas.map(([numero,titulo,texto])=><div key={numero}><span>{numero}</span><h3>{titulo}</h3><p>{texto}</p></div>)}</div>
        <Link href="/site/como-funciona" className="brand-text-link">Veja como funciona <ArrowUpRight size={17} aria-hidden="true" /></Link>
      </section>
      <section className="brand-invitation"><p className="brand-eyebrow">Sua próxima memória começa aqui</p><h2 className="brand-title">Vamos dar forma<br />à sua comemoração?</h2><p>Escolha uma inspiração. O próximo passo a gente combina com você.</p><Link href="/site/kits" className="brand-button">Explorar as decorações <ArrowUpRight size={18} aria-hidden="true" /></Link></section>
    </main>
  </SitePublicoLayout>
}
