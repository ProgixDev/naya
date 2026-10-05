'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  Heart,
  Clock3,
  MapPin,
  Plus,
  Minus,
  Menu,
  X,
  Check,
  Navigation,
  Smartphone,
  CalendarDays,
  ChevronDown,
} from 'lucide-react';
import { Hydrate, Modal, Avatar, useDisclosureFocus } from './ui';
import { useNaya, money } from '@/lib/store';
import { JourneyMap } from './map';

const places = [
  'Agdal, avenue de France',
  'Hassan, gare Rabat Ville',
  'Hay Riad, Mahaj Riad',
  'Souissi, avenue Mohammed VI',
  'Médina, Bab El Had',
  'Océan, avenue du Liban',
];
const faqs = [
  [
    'À qui s’adresse Naya ?',
    'Naya est un service de mobilité dédié aux femmes, avec des chauffeuses partenaires. Les enfants accompagnés de leur mère sont également les bienvenus.',
  ],
  [
    'Comment réserver une course ?',
    'Choisissez votre point de départ et votre destination, consultez le tarif estimé, puis confirmez. Vous pouvez aussi planifier votre trajet à l’avance. Ce site permet de découvrir le parcours avec une réservation de démonstration.',
  ],
  [
    'Dans quelles villes Naya est-elle disponible ?',
    'Naya prépare son lancement à Rabat : Agdal, Hassan, Hay Riad, Souissi, Océan et Médina. Les autres villes seront annoncées prochainement.',
  ],
  [
    'Comment sont sélectionnées les chauffeuses ?',
    'Les dossiers d’identité, permis de conduire et documents du véhicule font l’objet d’un examen avant l’activation du compte. Les candidates rejoignent ensuite notre parcours d’accueil.',
  ],
  [
    'Quels moyens de paiement sont acceptés ?',
    'Le parcours prévoit le paiement par carte bancaire et en espèces, en dirhams marocains (MAD). Dans ce prototype, aucun paiement réel n’est effectué.',
  ],
];

export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const [menu, setMenu] = useState(false),
    [modal, setModal] = useState<'booking' | 'driver' | 'app' | 'legal' | null>(null),
    [faq, setFaq] = useState<number | null>(0);
  const [from, setFrom] = useState(places[0]),
    [to, setTo] = useState(places[2]),
    [quote, setQuote] = useState(false),
    [bookingId, setBookingId] = useState<string | null>(null);
  const [name, setName] = useState(''),
    [phone, setPhone] = useState(''),
    [vehicle, setVehicle] = useState(''),
    [joined, setJoined] = useState(false),
    [date, setDate] = useState(''),
    [schedule, setSchedule] = useState(false),
    [payment, setPayment] = useState('Carte');
  const addRide = useNaya((s) => s.addRide),
    addDriver = useNaya((s) => s.addDriver),
    serviceOpen = useNaya((s) => s.serviceOpen);
  useDisclosureFocus(navigation, menu, () => setMenu(false));
  useEffect(() => {
    const mq = matchMedia('(max-width: 1000px)');
    const close = () => {
      if (!mq.matches) setMenu(false);
    };
    mq.addEventListener('change', close);
    return () => mq.removeEventListener('change', close);
  }, []);
  const price = 38 + Math.abs(places.indexOf(from) - places.indexOf(to)) * 12;
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        gsap.from('[data-hero]', {
          y: 25,
          opacity: 0,
          duration: 0.85,
          stagger: 0.12,
          ease: 'power3.out',
        });
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) =>
          gsap.from(el, {
            y: 35,
            opacity: 0,
            duration: 0.8,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          }),
        );
        gsap.from('.journey-line path', {
          strokeDashoffset: 580,
          duration: 1.1,
          ease: 'power2.out',
          scrollTrigger: { trigger: '.steps', start: 'top 80%', once: true },
        });
        gsap.to('.hero-photo img', {
          scale: 1.03,
          ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 },
        });
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);
  const open = (type: typeof modal, estimated = false) => {
    setMenu(false);
    setModal(type);
    setQuote(estimated);
    setBookingId(null);
    setJoined(false);
    setName('');
    setPhone('');
    setDate('');
    setSchedule(false);
  };
  const book = (e: FormEvent) => {
    e.preventDefault();
    const id = addRide({
      passenger: name,
      driver: 'Amina Bennani',
      from,
      to,
      amount: price,
      status: schedule ? 'Planifiée' : 'En cours',
      time: schedule
        ? date.slice(11)
        : new Date().toLocaleTimeString('fr-MA', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Africa/Casablanca',
          }),
      method: payment,
      city: 'Rabat',
      date: schedule ? date.slice(0, 10) : undefined,
    });
    setBookingId(id);
  };
  const apply = (e: FormEvent) => {
    e.preventDefault();
    addDriver({ name, phone, vehicle });
    setJoined(true);
  };
  return (
    <div ref={root} className="landing">
      <Hydrate />
      <div className="announcement">
        <span className="small-dot" />
        Une nouvelle façon de bouger, bientôt à Rabat.
        <a href="#ville">
          Découvrez Naya <ArrowRight size={13} />
        </a>
      </div>
      <a className="skip-link" href="#landing-content">
        Aller au contenu
      </a>
      <header className="site-nav">
        <Link href="/" aria-label="Naya, accueil">
          <img className="brand-logo" src="/images/logo.svg" alt="Naya" />
        </Link>
        <nav
          ref={navigation}
          id="site-navigation"
          aria-label="Navigation principale"
          className={menu ? 'nav-links open' : 'nav-links'}
        >
          <a href="#experience" onClick={() => setMenu(false)}>
            L’expérience Naya
          </a>
          <a href="#chauffeuses" onClick={() => setMenu(false)}>
            Devenir chauffeuse
          </a>
          <a href="#questions" onClick={() => setMenu(false)}>
            Vos questions
          </a>
          <Link className="mobile-backoffice" href="/backoffice">
            Backoffice <ArrowUpRight size={15} />
          </Link>
        </nav>
        <div className="nav-actions">
          <Link href="/backoffice" className="backoffice-link">
            Backoffice <ArrowUpRight size={14} />
          </Link>
          <button className="button button-plum" onClick={() => open('driver')}>
            Devenir chauffeuse <ArrowUpRight size={15} />
          </button>
          <button
            className="menu-button"
            aria-label={menu ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={menu}
            aria-controls="site-navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="landing-content">
        <section className="hero container">
          <div className="hero-copy">
            <div className="eyebrow" data-hero>
              <span className="small-dot" />
              PAR DES FEMMES. POUR DES FEMMES.
            </div>
            <h1 data-hero>
              <span>Votre ville.</span>
              <span>Votre liberté.</span>
            </h1>
            <p className="hero-description" data-hero>
              La mobilité entre femmes, pensée pour Rabat. Des chauffeuses partenaires, un tarif
              clair, et la ville qui s’ouvre à vous.
            </p>
            <div className="hero-buttons" data-hero>
              <a className="button button-plum button-large" href="#ville">
                Essayer un trajet <ArrowUpRight size={18} />
              </a>
              <a className="text-link" href="#experience">
                Découvrir l’expérience <ArrowRight size={17} />
              </a>
            </div>
            <div className="hero-trust" data-hero>
              <ShieldCheck size={19} />
              <span>Chauffeuses partenaires · Tarif annoncé avant confirmation</span>
            </div>
            <p className="launch-note" data-hero>
              <span className="small-dot" /> Lancement à venir à Rabat. Essayez le prototype, sans
              paiement.
            </p>
          </div>
          <div className="hero-visual" data-hero>
            <div className="hero-photo">
              <Image
                src="/images/hero-moroccan.png"
                alt="Une passagère et sa chauffeuse partagent un sourire dans une voiture lumineuse"
                width={1536}
                height={1024}
                sizes="(max-width: 1000px) calc(100vw - 40px), (max-width: 1440px) 55vw, 760px"
                preload
              />
              <div className="photo-caption">
                <span>
                  LE TRAJET CHANGE.
                  <br />
                  LE SENTIMENT AUSSI.
                </span>
                <span className="photo-index">01 / NAYA, RABAT</span>
              </div>
            </div>
            <div className="floating-driver">
              <span className="driver-check">
                <ShieldCheck size={18} />
              </span>
              <div>
                <strong>Vous êtes entre de bonnes mains.</strong>
                <span>Chauffeuses vérifiées · Trajets sereins</span>
              </div>
              <div className="floating-symbol">
                <img src="/images/symbol.svg" alt="" />
              </div>
            </div>
            <div className="hero-location">
              <MapPin size={14} />
              <span>Rabat, Maroc</span>
              <span>34.0209° N, 6.8416° W</span>
            </div>
          </div>
        </section>
        <div className="promise-strip container">
          <span>La sérénité fait partie du trajet.</span>
          <div>
            <ShieldCheck size={19} />
            100 % chauffeuses
          </div>
          <div>
            <Heart size={19} />
            Pensé pour vous
          </div>
          <div>
            <Clock3 size={19} />À votre rythme
          </div>
          <div>
            <MapPin size={19} />
            Ancré à Rabat
          </div>
        </div>
        <section id="ville" className="city-section">
          <div className="container city-layout">
            <div className="city-copy" data-reveal>
              <span className="eyebrow">01 — UNE VILLE, VOTRE TRAJET</span>
              <h2>
                Du premier rendez-vous
                <br />
                au dernier café.
              </h2>
              <p>
                Agdal, Hassan, Hay Riad… Choisissez votre départ et votre arrivée. Découvrez le
                parcours en quelques instants.
              </p>
              <div className="city-neighborhoods">
                AGDAL <span>·</span> HASSAN <span>·</span> HAY RIAD <span>·</span> SOUISSI
              </div>
              <JourneyMap from={from} to={to} />
            </div>
            <div className="booking-card" data-reveal>
              <span className="eyebrow">
                <span className="small-dot" />
                ESTIMATION DE DÉMONSTRATION
              </span>
              <h3>Où allons-nous ?</h3>
              <div className="booking-fields">
                <label>
                  <span className="route-dot" />
                  <span className="sr-only">Point de départ</span>
                  <select value={from} onChange={(e) => setFrom(e.target.value)}>
                    {places.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </label>
                <div className="route-connector" />
                <label>
                  <MapPin size={17} />
                  <span className="sr-only">Destination</span>
                  <select value={to} onChange={(e) => setTo(e.target.value)}>
                    {places.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </label>
              </div>
              <button
                className="button button-plum w-full"
                disabled={from === to || !serviceOpen}
                onClick={() => open('booking', true)}
              >
                {serviceOpen ? 'Voir mon estimation' : 'Service temporairement suspendu'}
                <ArrowRight size={17} />
              </button>
              <span className="booking-note">
                <ShieldCheck size={13} />
                Aucune course réelle. Aucun paiement.
              </span>
              <div className="booking-footer">
                <span>Rabat et ses quartiers</span>
                <span>À partir de 38 MAD</span>
              </div>
            </div>
          </div>
        </section>
        <section id="experience" className="experience container section-space">
          <div className="section-intro" data-reveal>
            <div>
              <span className="eyebrow">02 — EN CONFIANCE</span>
              <h2>
                La confiance se construit
                <br />à chaque étape.
              </h2>
            </div>
            <p>
              Savoir avec qui vous partez, combien vous payez et où vous allez. Trois repères pour
              prendre la route sereinement.
            </p>
          </div>
          <div className="experience-grid" data-reveal>
            <article className="experience-card">
              <span className="feature-number">01</span>
              <ShieldCheck size={28} strokeWidth={1.25} />
              <h3>
                La confiance,
                <br />
                dès le premier instant.
              </h3>
              <p>
                Une chauffeuse vérifiée, un tarif annoncé et les informations de votre trajet à
                portée de main.
              </p>
              <span className="card-bottom">
                VOTRE SÉRÉNITÉ, NOTRE PRIORITÉ <ArrowUpRight size={16} />
              </span>
            </article>
            <article className="experience-card lilac">
              <span className="feature-number">02</span>
              <Heart size={28} strokeWidth={1.25} />
              <h3>
                Entre femmes.
                <br />
                Tout simplement.
              </h3>
              <p>
                Un espace bienveillant où vous vous sentez à votre place. Sans explication, sans
                compromis.
              </p>
              <span className="card-bottom">
                UNE MOBILITÉ QUI NOUS RASSEMBLE <ArrowUpRight size={16} />
              </span>
            </article>
            <article className="experience-card rose">
              <span className="feature-number">03</span>
              <Clock3 size={28} strokeWidth={1.25} />
              <h3>
                Votre journée.
                <br />
                Vos horaires.
              </h3>
              <p>
                Un départ maintenant ou une course planifiée. Naya s’adapte à votre quotidien, pas
                l’inverse.
              </p>
              <span className="card-bottom">
                BOUGEZ À VOTRE RYTHME <ArrowUpRight size={16} />
              </span>
            </article>
          </div>
        </section>
        <section className="how-section container section-space">
          <div data-reveal>
            <span className="eyebrow">03 — SIMPLE, DU DÉBUT À LA FIN</span>
            <h2>
              Un départ.
              <br />
              Trois étapes simples.
            </h2>
          </div>
          <div className="steps" data-reveal>
            <svg className="journey-line" viewBox="0 0 600 20" aria-hidden="true">
              <path d="M10 10H590" />
            </svg>
            {[
              [
                Smartphone,
                'Choisissez votre trajet',
                'Votre départ, votre destination. Le tarif est annoncé, vous décidez.',
              ],
              [
                Navigation,
                'Rencontrez votre chauffeuse',
                'Retrouvez son prénom, son véhicule et son heure d’arrivée.',
              ],
              [Heart, 'Profitez du moment', 'Installez-vous. Respirez. Vous êtes déjà en route.'],
            ].map(([Icon, title, copy], i) => {
              const I = Icon as typeof Heart;
              return (
                <article key={i}>
                  <span className="step-index">0{i + 1}</span>
                  <I size={24} strokeWidth={1.4} />
                  <h3>{title as string}</h3>
                  <p>{copy as string}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section id="chauffeuses" className="driver-section">
          <div className="driver-image" data-reveal>
            <Image
              src="/images/driver-moroccan.png"
              alt="Une chauffeuse sourit, assise dans son véhicule à la portière ouverte"
              width={1254}
              height={1254}
              sizes="(max-width: 760px) 100vw, 55vw"
            />
            <span className="driver-image-note">ENSEMBLE, ON VA PLUS LOIN.</span>
          </div>
          <div className="driver-copy" data-reveal>
            <span className="eyebrow">04 — PRENEZ LE VOLANT</span>
            <h2>
              Prenez le volant
              <br />
              de votre quotidien.
            </h2>
            <p>
              Des horaires choisis. Une équipe à vos côtés. Rejoignez le projet Naya et participez à
              une nouvelle mobilité à Rabat.
            </p>
            <ul>
              <li>
                <Check size={17} />
                Des horaires qui s’adaptent à votre vie
              </li>
              <li>
                <Check size={17} />
                Des revenus clairs, sans surprise
              </li>
              <li>
                <Check size={17} />
                Une équipe présente à chaque étape
              </li>
            </ul>
            <button className="button button-plum button-large" onClick={() => open('driver')}>
              Devenir chauffeuse Naya <ArrowUpRight size={17} />
            </button>
            <span className="driver-small">
              Candidature → Examen des pièces → Accueil par l’équipe. Identité, permis et documents
              du véhicule requis. Démonstration locale, aucun contact réel.
            </span>
          </div>
        </section>
        <section id="questions" className="faq-section container section-space">
          <div data-reveal>
            <span className="eyebrow">05 — ON VOUS RÉPOND</span>
            <h2>
              Tout simplement,
              <br />
              vos questions.
            </h2>
            <p>La confiance commence par la clarté.</p>
          </div>
          <div className="faq-list" data-reveal>
            {faqs.map(([q, a], i) => (
              <div className="faq-item" key={q}>
                <button
                  aria-expanded={faq === i}
                  aria-controls={`faq-${i}`}
                  onClick={() => setFaq(faq === i ? null : i)}
                >
                  {q}
                  {faq === i ? <Minus size={18} /> : <Plus size={18} />}
                </button>
                <div id={`faq-${i}`} hidden={faq !== i}>
                  <p>{a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="final-cta" data-reveal>
          <div className="container">
            <span className="eyebrow">LA VILLE EST À VOUS.</span>
            <h2>À vous le prochain départ.</h2>
            <a className="button button-light button-large" href="#ville">
              Essayer un trajet <ArrowUpRight size={18} />
            </a>
            <p className="cta-demo-note">Prototype gratuit · Aucun véhicule ni paiement réel</p>
            <div className="cta-symbol">
              <img src="/images/symbol.svg" alt="" />
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer container">
        <div className="footer-top">
          <div>
            <img className="brand-logo" src="/images/logo.svg" alt="Naya" />
            <p>Votre ville. Votre liberté.</p>
          </div>
          <div>
            <a href="#experience">L’expérience</a>
            <a href="#chauffeuses">Devenir chauffeuse</a>
            <a href="#questions">Questions fréquentes</a>
            <Link href="/backoffice">
              Espace équipe <ArrowUpRight size={13} />
            </Link>
          </div>
          <span className="footer-location">
            <MapPin size={14} />
            Pensé pour les femmes.
            <br />
            Né au Maroc.
          </span>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Naya. Tous droits réservés.</span>
          <span>Prototype · Aucune course ni transaction réelle.</span>
          <button onClick={() => open('legal')}>Confidentialité & mentions légales</button>
        </div>
      </footer>
      {modal && (
        <Modal
          title={
            modal === 'booking'
              ? 'Votre prochain trajet'
              : modal === 'driver'
                ? 'Rejoignez les chauffeuses Naya'
                : modal === 'app'
                  ? 'Bienvenue chez Naya'
                  : 'À propos de ce prototype'
          }
          onClose={() => setModal(null)}
        >
          {modal === 'booking' &&
            (bookingId ? (
              <div className="success-state">
                <span className="success-icon">
                  <Check size={30} />
                </span>
                <span className="eyebrow">
                  {schedule ? 'VOTRE COURSE EST PLANIFIÉE' : 'VOTRE DÉMONSTRATION EST ENREGISTRÉE'}
                </span>
                <h3>Bon voyage, {name.split(' ')[0]}.</h3>
                <p>
                  Votre course <strong>{bookingId}</strong> est enregistrée.
                  <br />
                  {schedule
                    ? 'Retrouvez votre réservation dans l’espace équipe.'
                    : 'Amina Bennani vous accompagne pour ce trajet de démonstration.'}
                </p>
                <div className="driver-summary">
                  <Avatar name="Amina Bennani" size={44} />
                  <div>
                    <strong>Amina Bennani</strong>
                    <span>Naya Signature · Pearl · ★ 4,98</span>
                  </div>
                </div>
                <Link href="/backoffice/courses" className="button button-plum w-full">
                  Voir dans le backoffice <ArrowUpRight size={16} />
                </Link>
              </div>
            ) : (
              <form onSubmit={book}>
                <p className="modal-description">
                  Un départ, une destination. Et la liberté d’y aller.
                </p>
                {!quote && (
                  <>
                    <label className="field-label">
                      Départ
                      <select
                        className="input"
                        value={from}
                        onChange={(e) => {
                          setFrom(e.target.value);
                          setQuote(false);
                        }}
                      >
                        {places.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field-label">
                      Destination
                      <select
                        className="input"
                        value={to}
                        onChange={(e) => {
                          setTo(e.target.value);
                          setQuote(false);
                        }}
                      >
                        {places.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </label>
                    {from === to && (
                      <p className="field-error">
                        Choisissez une destination différente du départ.
                      </p>
                    )}
                  </>
                )}
                {quote && (
                  <div className="booking-review-route">
                    <span className="eyebrow">VOTRE TRAJET DE DÉMONSTRATION</span>
                    <strong>{from}</strong>
                    <ArrowRight size={16} />
                    <strong>{to}</strong>
                    <button type="button" className="text-link" onClick={() => setQuote(false)}>
                      Modifier le trajet
                    </button>
                  </div>
                )}
                {!quote ? (
                  <button
                    type="button"
                    className="button button-plum w-full"
                    disabled={from === to || !serviceOpen}
                    onClick={() => setQuote(true)}
                  >
                    Estimer mon trajet <ArrowRight size={16} />
                  </button>
                ) : (
                  <>
                    <div className="quote-panel">
                      <div>
                        <span>Votre tarif estimé</span>
                        <strong>{money(price)}</strong>
                      </div>
                      <span>Environ {Math.round(price / 4)} min · Naya Signature</span>
                    </div>
                    <label className="field-label">
                      Votre prénom et nom
                      <input
                        className="input"
                        value={name}
                        required
                        minLength={2}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex. Salma El Mansouri"
                        autoComplete="name"
                      />
                    </label>
                    <div className="form-grid">
                      <label className="field-label">
                        Paiement
                        <select
                          className="input"
                          value={payment}
                          onChange={(e) => setPayment(e.target.value)}
                        >
                          <option>Carte</option>
                          <option>Espèces</option>
                        </select>
                      </label>
                      <label className="field-label">
                        Quand partir ?
                        <select
                          aria-label="Moment du départ"
                          className="input"
                          value={schedule ? 'later' : 'now'}
                          onChange={(e) => setSchedule(e.target.value === 'later')}
                        >
                          <option value="now">Maintenant</option>
                          <option value="later">Planifier</option>
                        </select>
                      </label>
                    </div>
                    {schedule && (
                      <label className="field-label">
                        Date et heure <CalendarDays size={14} />
                        <input
                          className="input"
                          type="datetime-local"
                          value={date}
                          required
                          min={new Date(Date.now() + 60000)
                            .toLocaleString('sv-SE', { timeZone: 'Africa/Casablanca' })
                            .slice(0, 16)
                            .replace(' ', 'T')}
                          onChange={(e) => setDate(e.target.value)}
                        />
                      </label>
                    )}
                    <button className="button button-plum w-full" disabled={!serviceOpen}>
                      Confirmer la démonstration · {money(price)}
                      <ArrowRight size={16} />
                    </button>
                  </>
                )}
                <p className="prototype-note">
                  Démonstration uniquement. Aucun paiement ni véhicule réel.
                </p>
              </form>
            ))}
          {modal === 'driver' &&
            (joined ? (
              <div className="success-state">
                <span className="success-icon">
                  <Check size={30} />
                </span>
                <h3>Le début d’une belle route.</h3>
                <p>
                  Merci {name.split(' ')[0]}. Votre candidature est enregistrée et disponible dans
                  les vérifications du backoffice.
                </p>
                <Link href="/backoffice/verifications" className="button button-plum w-full">
                  Voir mon dossier de démonstration <ArrowUpRight size={16} />
                </Link>
              </div>
            ) : (
              <form onSubmit={apply}>
                <p className="modal-description">
                  Prenez le volant de votre prochaine opportunité.
                </p>
                <label className="field-label">
                  Prénom et nom
                  <input
                    className="input"
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    placeholder="Votre nom complet"
                  />
                </label>
                <label className="field-label">
                  Téléphone
                  <input
                    className="input"
                    type="tel"
                    required
                    pattern="[+0-9 ()-]{9,20}"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    placeholder="+212 6 00 00 00 00"
                  />
                </label>
                <label className="field-label">
                  Votre véhicule
                  <input
                    className="input"
                    required
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                    placeholder="Ex. Toyota Yaris"
                  />
                </label>
                <label className="consent">
                  <input type="checkbox" required />
                  Je souhaite être contactée pour rejoindre Naya.
                </label>
                <button className="button button-plum w-full">
                  Envoyer ma candidature <ArrowUpRight size={16} />
                </button>
                <p className="prototype-note">
                  Données enregistrées localement dans ce navigateur pour la démonstration.
                </p>
              </form>
            ))}
          {modal === 'app' && (
            <div className="app-modal">
              <img src="/images/symbol.svg" alt="" />
              <h3>
                Un premier pas
                <br />
                vers plus de liberté.
              </h3>
              <p>
                Naya se prépare à prendre la route à Rabat.
                <br />
                Découvrez dès maintenant votre prochain trajet.
              </p>
              <button className="button button-plum w-full" onClick={() => open('booking')}>
                Essayer le parcours passagère <ArrowUpRight size={16} />
              </button>
              <button className="button button-outline w-full" onClick={() => open('driver')}>
                Rejoindre les chauffeuses <ArrowRight size={16} />
              </button>
              <span className="prototype-note">
                Les applications mobiles arriveront avec le lancement.
              </span>
            </div>
          )}
          {modal === 'legal' && (
            <div className="legal-copy">
              <p>
                Ce site est un prototype interactif de Naya. Les personnes, véhicules, courses et
                montants présentés sont fictifs. Les photographies ont été générées pour illustrer
                le concept.
              </p>
              <p>
                Les réservations, candidatures et modifications sont stockées uniquement dans votre
                navigateur. Elles ne sont pas transmises à une équipe opérationnelle. Aucun paiement
                n’est collecté.
              </p>
              <p>
                Vous pouvez supprimer ces données depuis les paramètres de votre navigateur. Le
                backoffice est un espace de démonstration accessible sans authentification.
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
