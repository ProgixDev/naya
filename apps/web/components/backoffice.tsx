'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import gsap from 'gsap';
import {
  LayoutDashboard,
  Car,
  Users,
  ShieldCheck,
  Wallet,
  Headphones,
  Settings2,
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Search,
  Bell,
  Plus,
  Download,
  ArrowUp,
  Menu,
  X,
  SlidersHorizontal,
  Clock3,
  MapPin,
  Check,
  FileText,
  Star,
  Activity,
  LogOut,
  CalendarDays,
  CircleHelp,
  CreditCard,
  Banknote,
  CheckCircle2,
} from 'lucide-react';
import {
  useNaya,
  money,
  documentLabels,
  type Ride,
  type Driver,
  type Ticket,
  type DocumentKey,
} from '@/lib/store';
import { Hydrate, Modal, Avatar, Badge, Empty, exportCsv, useDisclosureFocus } from './ui';
import { WorkQueue, ActionConfirmation, ReviewDocuments, SupportDetail } from './operations';
import { OperationsMap } from './map';

const nav = [
  { id: 'overview', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { id: 'courses', label: 'Courses', icon: Car },
  { id: 'chauffeuses', label: 'Chauffeuses', icon: Users },
  { id: 'passageres', label: 'Passagères', icon: HeartIcon },
  { id: 'verifications', label: 'Vérifications', icon: ShieldCheck },
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'support', label: 'Support', icon: Headphones },
];
function HeartIcon({ size = 18 }: { size?: number }) {
  return <Users size={size} />;
}
const titles: Record<string, [string, string]> = {
  overview: ['Vue d’ensemble', 'Une ville en mouvement. Une équipe aux commandes.'],
  courses: ['Courses', 'Chaque trajet, du départ à l’arrivée.'],
  chauffeuses: ['Chauffeuses', 'Celles qui font avancer Naya, chaque jour.'],
  passageres: ['Passagères', 'Une communauté qui grandit avec vous.'],
  verifications: ['Vérifications', 'La confiance commence ici.'],
  finance: ['Finance', 'Vos chiffres, en toute clarté.'],
  support: ['Support', 'Être là, quand elles en ont besoin.'],
  parametres: ['Paramètres', 'Un service qui s’adapte à votre organisation.'],
  journal: ['Journal d’activité', 'Les décisions de votre équipe, en toute transparence.'],
};

export function Backoffice({ section }: { section: string }) {
  const s = useNaya(),
    [mobile, setMobile] = useState(false),
    [compact, setCompact] = useState(false),
    [period, setPeriod] = useState('today'),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('Tous'),
    [detail, setDetail] = useState<Ride | Driver | Ticket | null>(null),
    [notifications, setNotifications] = useState(false),
    [create, setCreate] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  useDisclosureFocus(sidebar, compact && mobile, () => setMobile(false), true);
  useEffect(() => {
    const media = matchMedia('(max-width: 760px)');
    const update = () => {
      setCompact(media.matches);
      if (!media.matches) setMobile(false);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!notifications) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifications(false);
        notificationRef.current?.querySelector('button')?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node))
        setNotifications(false);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', outside);
    };
  }, [notifications]);
  const heading = titles[section];
  useEffect(() => {
    setSearch('');
    setStatus('Tous');
    setMobile(false);
    setDetail(null);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const ctx = gsap.context(
        () =>
          gsap.from('.page-header, .dashboard-content > *', {
            opacity: 0,
            y: 12,
            duration: 0.35,
            stagger: 0.045,
            ease: 'power2.out',
          }),
        content,
      );
      return () => ctx.revert();
    }
  }, [section]);
  const cityRides = s.rides.filter((r) => r.city === s.city),
    drivers = s.drivers.filter((d) => d.city === s.city),
    pending = drivers.filter((d) => d.status === 'À vérifier'),
    online = drivers.filter((d) => d.status === 'En ligne');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Casablanca' });
  const periodRides = cityRides.filter((r) =>
    period === 'today'
      ? r.date === today
      : period === 'week'
        ? new Date(r.date) >= new Date(Date.now() - 7 * 86400000)
        : true,
  );
  const completed = periodRides.filter((r) => r.status === 'Terminée'),
    volume = completed.reduce((a, r) => a + r.amount, 0),
    active = cityRides.filter((r) => r.status === 'En cours');
  const filtered = cityRides.filter(
    (r) =>
      (status === 'Tous' || r.status === status) &&
      `${r.id} ${r.passenger} ${r.driver} ${r.from} ${r.to}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const cityTickets = s.tickets.filter((ticket) => (ticket.city ?? 'Rabat') === s.city);
  const visibleTickets = cityTickets
    .filter(
      (ticket) =>
        (status === 'Tous' || ticket.status === status) &&
        `${ticket.name} ${ticket.subject} ${ticket.id}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => Number(b.priority === 'Haute') - Number(a.priority === 'Haute'));
  const exportSection = () => {
    if (section === 'support')
      exportCsv(
        'naya-support',
        visibleTickets.map((ticket) => ({
          Référence: ticket.id,
          Sujet: ticket.subject,
          Passagère: ticket.name,
          Priorité: ticket.priority,
          Statut: ticket.status,
          Assignée: ticket.assignee ?? 'Non assignée',
        })),
      );
    else if (section === 'chauffeuses' || section === 'verifications')
      exportCsv(
        'naya-chauffeuses',
        (section === 'verifications'
          ? pending
          : drivers.filter(
              (driver) =>
                (status === 'Tous' || driver.status === status) &&
                `${driver.name} ${driver.vehicle}`.toLowerCase().includes(search.toLowerCase()),
            )
        ).map((driver) => ({
          Nom: driver.name,
          Téléphone: driver.phone,
          Véhicule: driver.vehicle,
          Statut: driver.status,
        })),
      );
    else if (section === 'passageres')
      exportCsv(
        'naya-passageres',
        [...new Set(cityRides.map((ride) => ride.passenger))]
          .filter((name) => name.toLowerCase().includes(search.toLowerCase()))
          .map((name) => ({
            Nom: name,
            Courses: cityRides.filter((ride) => ride.passenger === name).length,
            Total_MAD: cityRides
              .filter((ride) => ride.passenger === name && ride.status === 'Terminée')
              .reduce((total, ride) => total + ride.amount, 0),
          })),
      );
    else if (section === 'journal')
      exportCsv(
        'naya-journal',
        s.audit.map((item) => ({ Action: item.action, Date: item.date })),
      );
    else if (section === 'finance')
      exportCsv(
        'naya-finance',
        completed.map((ride) => ({
          Référence: ride.id,
          Montant_MAD: ride.amount,
          Commission_MAD: Number(((ride.amount * s.commission) / 100).toFixed(2)),
          Net_MAD: Number((ride.amount * (1 - s.commission / 100)).toFixed(2)),
        })),
      );
  };
  const exportRides = () =>
    exportCsv(
      'naya-courses',
      filtered.map((r) => ({
        Référence: r.id,
        Passagère: r.passenger,
        Chauffeuse: r.driver,
        Départ: r.from,
        Destination: r.to,
        Statut: r.status,
        Montant_MAD: r.amount,
        Paiement: r.method,
        Date: r.date,
      })),
    );
  return (
    <div className="backoffice">
      <Hydrate />
      <a className="skip-link" href="#main-content">
        Aller au contenu
      </a>
      {compact && mobile && <div className="sidebar-scrim" onClick={() => setMobile(false)} />}
      <aside
        ref={sidebar}
        id="office-navigation"
        className={`sidebar ${mobile ? 'sidebar-open' : ''}`}
        hidden={compact && !mobile}
        role={compact ? 'dialog' : undefined}
        aria-modal={compact && mobile ? true : undefined}
        aria-label="Navigation du backoffice"
        tabIndex={-1}
      >
        <div className="sidebar-brand">
          <Link href="/" aria-label="Retour au site Naya">
            <img src="/images/logo.svg" alt="Naya" />
          </Link>
          <span>ESPACE ÉQUIPE</span>
          <button
            className="mobile-close icon-button"
            onClick={() => setMobile(false)}
            aria-label="Fermer la navigation"
          >
            <X size={18} />
          </button>
        </div>
        <button
          className="workspace-switch"
          onClick={() => s.notify('Vous travaillez dans l’espace Naya Maroc')}
        >
          <span className="workspace-icon">
            <img src="/images/symbol.svg" alt="" />
          </span>
          <span>
            <strong>Naya Maroc</strong>
            <small>Équipe opérations</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <span className="nav-caption">VOTRE ESPACE</span>
        <nav aria-label="Navigation du backoffice">
          {nav.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              href={id === 'overview' ? '/backoffice' : `/backoffice/${id}`}
              className={section === id ? 'active' : ''}
              aria-current={section === id ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === 'verifications' && pending.length > 0 && (
                <span className="nav-count">{pending.length}</span>
              )}
              {id === 'support' && s.tickets.filter((t) => t.status === 'Ouvert').length > 0 && (
                <span className="support-dot" />
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/backoffice/journal" className={section === 'journal' ? 'active' : ''}>
            <Activity size={17} />
            Journal d’activité
          </Link>
          <Link href="/backoffice/parametres" className={section === 'parametres' ? 'active' : ''}>
            <Settings2 size={17} />
            Paramètres
          </Link>
          <div className="team-help">
            <span className="help-icon">
              <CircleHelp size={19} />
            </span>
            <strong>Un coup de main ?</strong>
            <p>L’équipe Naya est à vos côtés.</p>
            <Link href="/backoffice/support">
              Ouvrir le support <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="sidebar-user">
            <Avatar name="Meryem Bennis" size={36} />
            <div>
              <strong>Meryem Bennis</strong>
              <span>Administratrice</span>
            </div>
            <Link href="/" title="Retour au site" aria-label="Retour au site">
              <LogOut size={16} />
            </Link>
          </div>
        </div>
      </aside>
      <div className="office-main" inert={compact && mobile}>
        <header className="office-topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-open icon-button"
              onClick={() => setMobile(true)}
              aria-label="Ouvrir la navigation"
              aria-expanded={mobile}
              aria-controls="office-navigation"
            >
              <Menu size={20} />
            </button>
            <span>Espace équipe</span>
            <ChevronRight size={13} />
            <strong>{heading?.[0] ?? 'Page introuvable'}</strong>
          </div>
          <div className="topbar-actions">
            <Link href="/">
              Voir le site <ArrowUpRight size={14} />
            </Link>
            <span className="vertical-divider" />
            <span className="demo-label">DÉMO</span>
            <div className="notification-wrap" ref={notificationRef}>
              <button
                className="icon-button notification-button"
                aria-label="Notifications"
                aria-expanded={notifications}
                onClick={() => {
                  setNotifications(!notifications);
                  s.readNotifications();
                }}
              >
                <Bell size={19} />
                {!s.notificationsRead && <i />}
              </button>
              {notifications && (
                <div className="notification-popover">
                  <strong>Votre activité</strong>
                  <p>
                    {pending.length} dossier{pending.length > 1 ? 's' : ''} en attente de
                    vérification.
                  </p>
                  <Link href="/backoffice/verifications" onClick={() => setNotifications(false)}>
                    Examiner les dossiers <ArrowRight size={14} />
                  </Link>
                  <p>
                    {s.tickets.filter((t) => t.status === 'Ouvert').length} demande(s) support
                    ouvertes.
                  </p>
                  <Link href="/backoffice/support" onClick={() => setNotifications(false)}>
                    Voir les demandes <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>
            <Avatar name="Meryem Bennis" size={30} />
          </div>
        </header>
        <main className="office-content" id="main-content" ref={content}>
          {!heading ? (
            <div className="panel">
              <Empty
                title="Cette page n’existe pas"
                description="Retrouvez vos opérations depuis la vue d’ensemble."
              />
              <Link href="/backoffice" className="button button-plum">
                Retour à la vue d’ensemble
              </Link>
            </div>
          ) : (
            <>
              <div className="office-context">
                <span>
                  <span className={`small-dot ${s.serviceOpen ? 'green-dot' : ''}`} />
                  {s.serviceOpen
                    ? 'Les opérations suivent leur cours'
                    : 'Service temporairement suspendu'}
                </span>
                <span>
                  {new Date().toLocaleDateString('fr-MA', {
                    timeZone: 'Africa/Casablanca',
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="page-header">
                <div>
                  <h1>{heading[0]}</h1>
                  <p>{heading[1]}</p>
                </div>
                <div className="page-actions">
                  <label className="city-select">
                    <MapPin size={15} />
                    <select
                      aria-label="Ville"
                      value={s.city}
                      onChange={(e) => s.setCity(e.target.value)}
                    >
                      <option>Rabat</option>
                      <option>Casablanca</option>
                    </select>
                    <ChevronDown size={13} />
                  </label>
                  {section === 'overview' || section === 'courses' ? (
                    <button
                      className="button button-plum button-small"
                      onClick={() => setCreate(true)}
                    >
                      <Plus size={16} />
                      Nouvelle course
                    </button>
                  ) : section !== 'parametres' && heading ? (
                    <button className="button button-outline button-small" onClick={exportSection}>
                      <Download size={15} />
                      Exporter
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="dashboard-content">
                {section === 'overview' && (
                  <>
                    <div className="overview-toolbar">
                      <div className="period-tabs" role="group" aria-label="Période">
                        {[
                          ['today', 'Aujourd’hui'],
                          ['week', '7 derniers jours'],
                          ['month', 'Tout l’historique'],
                        ].map(([v, l]) => (
                          <button
                            key={v}
                            onClick={() => setPeriod(v)}
                            className={period === v ? 'active' : ''}
                            aria-pressed={period === v}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                      <span className="updated">
                        <span className="small-dot green-dot" />
                        Données de démonstration
                      </span>
                    </div>
                    <div className="metrics-grid">
                      <Metric
                        label="Courses terminées"
                        value={String(completed.length).padStart(2, '0')}
                        icon={Car}
                        note={`${active.length} courses en cours`}
                        accent
                      />
                      <Metric
                        label="Montant des courses"
                        value={money(volume)}
                        icon={Wallet}
                        note={`${s.commission} % de commission`}
                      />
                      <Metric
                        label="Chauffeuses en ligne"
                        value={String(online.length).padStart(2, '0')}
                        icon={Users}
                        note={`${drivers.filter((d) => d.status !== 'À vérifier' && d.status !== 'Refusée').length} partenaires · État actuel`}
                      />
                      <Metric
                        label="Dossiers à examiner"
                        value={String(pending.length).padStart(2, '0')}
                        icon={ShieldCheck}
                        note="En attente · État actuel"
                      />
                    </div>
                    <WorkQueue drivers={drivers} tickets={cityTickets} onSelect={setDetail} />
                    <div className="analytics-grid">
                      <div className="panel chart-panel">
                        <div className="panel-heading">
                          <div>
                            <h2>L’activité, au fil de la journée</h2>
                            <p>Courses de la période sélectionnée</p>
                          </div>
                          <span className="chart-legend">
                            <i />
                            Courses
                          </span>
                        </div>
                        <ActivityChart rides={periodRides} />
                        <div className="chart-summary">
                          <span>
                            <strong>{periodRides.length}</strong> courses enregistrées
                          </span>
                          <span>
                            <Clock3 size={13} />
                            Horaires de Rabat
                          </span>
                        </div>
                      </div>
                      <div className="panel distribution-panel">
                        <div className="panel-heading">
                          <div>
                            <h2>Chaque trajet compte</h2>
                            <p>Répartition des courses</p>
                          </div>
                          <ArrowUpRight size={18} />
                        </div>
                        <Donut rides={periodRides} />
                        <div className="distribution-legend">
                          {['Terminée', 'En cours', 'Planifiée', 'Annulée'].map((label, i) => (
                            <div key={label}>
                              <span>
                                <i
                                  style={{
                                    background: ['#6B3657', '#AC7C99', '#DBCAD5', '#E8E4E7'][i],
                                  }}
                                />
                                {label === 'Terminée'
                                  ? 'Terminées'
                                  : label === 'Planifiée'
                                    ? 'Planifiées'
                                    : label === 'Annulée'
                                      ? 'Annulées'
                                      : label}
                              </span>
                              <strong>
                                {periodRides.filter((r) => r.status === label).length}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="operations-grid">
                      <div className="panel map-panel">
                        <div className="panel-heading">
                          <div>
                            <h2>Rabat, en mouvement</h2>
                            <p>Une vue sur vos chauffeuses et vos zones</p>
                          </div>
                          <Link href="/backoffice/chauffeuses" className="panel-link">
                            Voir la flotte <ArrowUpRight size={14} />
                          </Link>
                        </div>
                        {s.city === 'Rabat' ? (
                          <OperationsMap drivers={online} />
                        ) : (
                          <Empty
                            title="Bientôt à Casablanca"
                            description="Aucune zone active dans cette ville."
                          />
                        )}
                      </div>
                    </div>
                    <div className="panel rides-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Les derniers départs</h2>
                          <p>Un aperçu de vos courses les plus récentes</p>
                        </div>
                        <Link href="/backoffice/courses" className="panel-link">
                          Toutes les courses <ArrowRight size={14} />
                        </Link>
                      </div>
                      <RideTable rides={cityRides.slice(0, 5)} onSelect={setDetail} />
                    </div>
                  </>
                )}
                {section === 'courses' && (
                  <div className="panel">
                    <div className="table-toolbar">
                      <div className="filter-tabs">
                        {['Tous', 'En cours', 'Terminée', 'Planifiée', 'Annulée'].map((t) => (
                          <button
                            key={t}
                            className={status === t ? 'active' : ''}
                            onClick={() => setStatus(t)}
                          >
                            {t === 'Tous' ? 'Toutes les courses' : t}
                            <span>
                              {cityRides.filter((r) => t === 'Tous' || r.status === t).length}
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="table-controls">
                        <SearchField
                          value={search}
                          onChange={setSearch}
                          placeholder="Rechercher une course…"
                        />
                        <button
                          className="icon-button bordered"
                          aria-label="Exporter les courses filtrées"
                          onClick={exportRides}
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </div>
                    <RideTable rides={filtered} onSelect={setDetail} />
                    <div className="table-footer">
                      <span>
                        {filtered.length} course{filtered.length > 1 ? 's' : ''} · Données de
                        démonstration
                      </span>
                      <span>Montants en MAD</span>
                    </div>
                  </div>
                )}
                {section === 'chauffeuses' && (
                  <>
                    <div className="mini-metrics">
                      <span>
                        <strong>{drivers.length}</strong> chauffeuses partenaires
                      </span>
                      <span>
                        <i className="small-dot green-dot" />
                        <strong>{online.length}</strong> en ligne
                      </span>
                      <span>
                        <strong>{pending.length}</strong> dossiers à vérifier
                      </span>
                    </div>
                    <div className="panel">
                      <div className="table-toolbar">
                        <div className="filter-tabs">
                          {['Tous', 'En ligne', 'Hors ligne', 'À vérifier', 'Refusée'].map((t) => (
                            <button
                              key={t}
                              className={status === t ? 'active' : ''}
                              onClick={() => setStatus(t)}
                            >
                              {t === 'Tous' ? 'Toutes les chauffeuses' : t}
                            </button>
                          ))}
                        </div>
                        <SearchField
                          value={search}
                          onChange={setSearch}
                          placeholder="Nom, véhicule…"
                        />
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Chauffeuse</th>
                              <th>Véhicule</th>
                              <th>Courses</th>
                              <th>Note</th>
                              <th>Disponibilité</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {drivers
                              .filter(
                                (d) =>
                                  (status === 'Tous' || d.status === status) &&
                                  `${d.name} ${d.vehicle}`
                                    .toLowerCase()
                                    .includes(search.toLowerCase()),
                              )
                              .map((d) => (
                                <tr key={d.id}>
                                  <td>
                                    <button className="person-cell" onClick={() => setDetail(d)}>
                                      <Avatar name={d.name} />
                                      <span>
                                        <strong>{d.name}</strong>
                                        <small>{d.phone}</small>
                                      </span>
                                    </button>
                                  </td>
                                  <td>
                                    <strong>{d.vehicle}</strong>
                                    <small>{d.plate}</small>
                                  </td>
                                  <td>{d.rides}</td>
                                  <td>
                                    {d.rating ? (
                                      <span className="rating">
                                        <Star size={12} fill="currentColor" />
                                        {d.rating.toFixed(2)}
                                      </span>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td>
                                    <Badge>{d.status}</Badge>
                                  </td>
                                  <td>
                                    <button
                                      className="icon-button"
                                      aria-label={`Ouvrir ${d.name}`}
                                      onClick={() => setDetail(d)}
                                    >
                                      <ChevronRight size={16} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {!drivers.filter(
                          (d) =>
                            (status === 'Tous' || d.status === status) &&
                            `${d.name} ${d.vehicle}`.toLowerCase().includes(search.toLowerCase()),
                        ).length && <Empty />}
                      </div>
                    </div>
                  </>
                )}
                {section === 'passageres' && (
                  <Passengers
                    rides={cityRides}
                    search={search}
                    setSearch={setSearch}
                    onSelect={setDetail}
                  />
                )}
                {section === 'verifications' && (
                  <>
                    <div className="notice">
                      <ShieldCheck size={20} />
                      <div>
                        <strong>Chaque vérification renforce la confiance.</strong>
                        <span>
                          Examinez les dossiers avant d’activer les comptes. Tous les documents
                          présentés ici sont fictifs.
                        </span>
                      </div>
                    </div>
                    <div className="verification-grid">
                      {pending.map((d) => (
                        <div className="panel verification-card" key={d.id}>
                          <div className="verification-top">
                            <Avatar name={d.name} size={48} />
                            <Badge>{d.status}</Badge>
                          </div>
                          <h2>{d.name}</h2>
                          <p>
                            {d.vehicle} · {d.city}
                          </p>
                          <div className="document-list">
                            <span>
                              <FileText size={16} />
                              Identité <Badge>{d.documents?.identity ?? 'À examiner'}</Badge>
                            </span>
                            <span>
                              <FileText size={16} />
                              Permis de conduire{' '}
                              <Badge>{d.documents?.license ?? 'À examiner'}</Badge>
                            </span>
                            <span>
                              <FileText size={16} />
                              Documents du véhicule{' '}
                              <Badge>{d.documents?.vehicle ?? 'À examiner'}</Badge>
                            </span>
                          </div>
                          <button
                            className="button button-outline w-full"
                            onClick={() => setDetail(d)}
                          >
                            Examiner le dossier <ArrowRight size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {!pending.length && (
                      <div className="panel">
                        <Empty
                          title="Tous les dossiers sont à jour"
                          description="Les nouvelles candidatures apparaîtront ici."
                        />
                      </div>
                    )}
                  </>
                )}
                {section === 'finance' && (
                  <Finance rides={completed} commission={s.commission} onSelect={setDetail} />
                )}
                {section === 'support' && (
                  <>
                    <div className="panel">
                      <div className="table-toolbar">
                        <div className="filter-tabs">
                          {['Tous', 'Ouvert', 'En cours', 'Résolu'].map((t) => (
                            <button
                              key={t}
                              className={status === t ? 'active' : ''}
                              onClick={() => setStatus(t)}
                            >
                              {t === 'Tous' ? 'Toutes les demandes' : t}
                            </button>
                          ))}
                        </div>
                        <SearchField
                          value={search}
                          onChange={setSearch}
                          placeholder="Rechercher une demande…"
                        />
                      </div>
                      <div className="ticket-list">
                        {visibleTickets.map((t) => (
                          <button className="ticket-row" key={t.id} onClick={() => setDetail(t)}>
                            <Avatar name={t.name} size={40} />
                            <div>
                              <strong>{t.subject}</strong>
                              <span>
                                {t.name} · {t.id}
                              </span>
                            </div>
                            <span
                              className={`priority-label ${t.priority === 'Haute' ? 'high' : ''}`}
                            >
                              {t.priority}
                            </span>
                            <Badge>{t.status}</Badge>
                            <ChevronRight size={17} />
                          </button>
                        ))}
                      </div>
                      {!visibleTickets.length && <Empty />}
                    </div>
                  </>
                )}
                {section === 'parametres' && <Settings />}
                {section === 'journal' && (
                  <div className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Les actions de votre équipe</h2>
                        <p>Historique local des modifications du prototype</p>
                      </div>
                      <Badge>Validé</Badge>
                    </div>
                    {s.audit.length ? (
                      s.audit.map((a) => (
                        <div className="audit-row" key={a.id}>
                          <span className="priority-icon">
                            <Activity size={16} />
                          </span>
                          <div>
                            <strong>{a.action}</strong>
                            <span>Meryem Bennis · Administratrice</span>
                          </div>
                          <time>
                            {new Date(a.date).toLocaleString('fr-MA', {
                              timeZone: 'Africa/Casablanca',
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        </div>
                      ))
                    ) : (
                      <Empty
                        title="Une page encore blanche"
                        description="Vos réservations, vérifications et modifications apparaîtront ici."
                      />
                    )}
                  </div>
                )}
              </div>
              <footer className="office-footer">
                <span>
                  <img src="/images/symbol.svg" alt="" />
                  Naya · La confiance nous met en mouvement.
                </span>
                <span>Prototype interactif · Données fictives</span>
              </footer>
            </>
          )}
        </main>
      </div>
      {detail && <DetailModal key={detail.id} detail={detail} onClose={() => setDetail(null)} />}
      {create && <NewRide onClose={() => setCreate(false)} />}
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  icon: typeof Car;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className={`metric ${accent ? 'metric-accent' : ''}`}>
      <div>
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <p>
        <span className="metric-note-dot" />
        {note}
      </p>
    </div>
  );
}
function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search-field">
      <Search size={16} />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button onClick={() => onChange('')} aria-label="Effacer la recherche">
          <X size={14} />
        </button>
      )}
    </label>
  );
}
function RideTable({ rides, onSelect }: { rides: Ride[]; onSelect: (ride: Ride) => void }) {
  return (
    <div className="rides-list">
      <div className="ride-cards">
        {rides.map((ride) => (
          <button
            className="ride-card"
            key={ride.id}
            aria-label={`Détails de ${ride.id}`}
            onClick={() => onSelect(ride)}
          >
            <span className="ride-card-top">
              <strong>{ride.id}</strong>
              <Badge>{ride.status}</Badge>
            </span>
            <span className="ride-card-route">
              {ride.from.split(',')[0]} <ArrowRight size={16} /> {ride.to.split(',')[0]}
            </span>
            <span className="ride-card-people">
              {ride.passenger} · {ride.driver}
            </span>
            <span className="ride-card-bottom">
              <span>
                {ride.time} · {ride.method}
              </span>
              <strong>{money(ride.amount)}</strong>
            </span>
          </button>
        ))}
        {!rides.length && <Empty />}
      </div>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Tableau des courses">
        <table>
          <thead>
            <tr>
              <th>Référence</th>
              <th>Passagère</th>
              <th>Chauffeuse</th>
              <th>Trajet</th>
              <th>Statut</th>
              <th className="text-right">Montant</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rides.map((r) => (
              <tr key={r.id}>
                <td>
                  <button className="reference" onClick={() => onSelect(r)}>
                    {r.id}
                  </button>
                  <small>{r.time}</small>
                </td>
                <td>
                  <span className="person-cell">
                    <Avatar name={r.passenger} size={29} />
                    {r.passenger}
                  </span>
                </td>
                <td>{r.driver}</td>
                <td>
                  <span className="trip-cell">
                    <span>
                      <i />
                      {r.from.split(',')[0]}
                    </span>
                    <span>
                      <i />
                      {r.to.split(',')[0]}
                    </span>
                  </span>
                </td>
                <td>
                  <Badge>{r.status}</Badge>
                </td>
                <td className="text-right amount">{money(r.amount)}</td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`Détails de ${r.id}`}
                    onClick={() => onSelect(r)}
                  >
                    <ChevronRight size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rides.length && <Empty />}
      </div>
    </div>
  );
}
function ActivityChart({ rides }: { rides: Ride[] }) {
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const values = hours.map((h) => rides.filter((r) => Number(r.time.split(':')[0]) === h).length),
    max = Math.max(4, ...values);
  const points = values.map((v, i) => `${50 + i * 43},${165 - (v / max) * 120}`).join(' ');
  return (
    <div className="activity-chart">
      <svg
        viewBox="0 0 600 205"
        role="img"
        aria-label={`Graphique de ${rides.length} courses par heure`}
      >
        <defs>
          <linearGradient id="chartfill" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#6B3657" stopOpacity=".13" />
            <stop offset="1" stopColor="#6B3657" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((_, i) => (
          <g key={i}>
            <path d={`M50 ${165 - i * 30}H570`} stroke="#EEE9ED" strokeDasharray="3 4" />
            <text x="20" y={169 - i * 30} fontSize="10" fill="#655863">
              {Math.round((max * i) / 4)}
            </text>
          </g>
        ))}
        <polygon points={`50,165 ${points} 566,165`} fill="url(#chartfill)" />
        <polyline
          points={points}
          fill="none"
          stroke="#6B3657"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {values.map((v, i) => (
          <circle
            key={i}
            cx={50 + i * 43}
            cy={165 - (v / max) * 120}
            r={v ? 3.5 : 0}
            fill="#6B3657"
          >
            <title>{`${hours[i]} h : ${v} courses`}</title>
          </circle>
        ))}
        {hours
          .filter((_, i) => i % 2 === 0)
          .map((h, i) => (
            <text key={h} x={50 + i * 86} y="194" textAnchor="middle" fontSize="10" fill="#655863">
              {h}h
            </text>
          ))}
      </svg>
    </div>
  );
}
function Donut({ rides }: { rides: Ride[] }) {
  let offset = 0;
  const total = rides.length || 1;
  return (
    <div className="donut">
      <svg viewBox="0 0 160 160" role="img" aria-label="Répartition des statuts des courses">
        <circle cx="80" cy="80" r="61" stroke="#F0EBEF" strokeWidth="14" fill="none" />
        {['Terminée', 'En cours', 'Planifiée', 'Annulée'].map((status, i) => {
          const len = (rides.filter((r) => r.status === status).length / total) * 383.27;
          const start = offset;
          offset += len;
          return (
            <circle
              key={status}
              cx="80"
              cy="80"
              r="61"
              fill="none"
              stroke={['#6B3657', '#AC7C99', '#DBCAD5', '#E8E4E7'][i]}
              strokeWidth="14"
              strokeDasharray={`${Math.max(0, len - 3)} ${383.27 - Math.max(0, len - 3)}`}
              strokeDashoffset={-start}
              transform="rotate(-90 80 80)"
            />
          );
        })}
      </svg>
      <div>
        <strong>{rides.length}</strong>
        <span>courses</span>
      </div>
    </div>
  );
}
function Passengers({
  rides,
  search,
  setSearch,
  onSelect,
}: {
  rides: Ride[];
  search: string;
  setSearch: (v: string) => void;
  onSelect: (r: Ride) => void;
}) {
  const names = Array.from(new Set(rides.map((r) => r.passenger))).filter((n) =>
    n.toLowerCase().includes(search.toLowerCase()),
  );
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <div className="panel">
        <div className="table-toolbar">
          <h2>{new Set(rides.map((r) => r.passenger)).size} passagères dans votre communauté</h2>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Rechercher une passagère…"
          />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Passagère</th>
                <th>Courses</th>
                <th>Total des trajets</th>
                <th>Dernier départ</th>
                <th>Ville</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {names.map((n) => {
                const rows = rides.filter((r) => r.passenger === n);
                return (
                  <tr key={n}>
                    <td>
                      <button className="person-cell" onClick={() => setSelected(n)}>
                        <Avatar name={n} />
                        <strong>{n}</strong>
                      </button>
                    </td>
                    <td>{rows.length}</td>
                    <td className="amount">
                      {money(
                        rows
                          .filter((r) => r.status === 'Terminée')
                          .reduce((a, r) => a + r.amount, 0),
                      )}
                    </td>
                    <td>{rows[0]?.time ?? '—'}</td>
                    <td>{rows[0]?.city}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Profil de ${n}`}
                        onClick={() => setSelected(n)}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!names.length && <Empty />}
        </div>
      </div>
      {selected && (
        <Modal title={selected} onClose={() => setSelected(null)} wide>
          <div className="profile-heading">
            <Avatar name={selected} size={56} />
            <div>
              <h3>Passagère Naya</h3>
              <p>{rides.filter((r) => r.passenger === selected).length} course(s) enregistrée(s)</p>
            </div>
          </div>
          <RideTable
            rides={rides.filter((r) => r.passenger === selected)}
            onSelect={(r) => {
              setSelected(null);
              onSelect(r);
            }}
          />
        </Modal>
      )}
    </>
  );
}
function Finance({
  rides,
  commission,
  onSelect,
}: {
  rides: Ride[];
  commission: number;
  onSelect: (r: Ride) => void;
}) {
  const total = rides.reduce((a, r) => a + r.amount, 0),
    fee = (total * commission) / 100;
  return (
    <>
      <div className="metrics-grid finance-metrics">
        <Metric
          label="Volume total"
          value={money(total)}
          icon={Wallet}
          note="Courses terminées uniquement"
          accent
        />
        <Metric
          label="Commissions Naya"
          value={money(fee)}
          icon={CreditCard}
          note={`${commission} % du volume`}
        />
        <Metric
          label="Revenus chauffeuses"
          value={money(total - fee)}
          icon={Users}
          note="Après commission"
        />
        <Metric
          label="Paiements en espèces"
          value={money(
            rides.filter((r) => r.method === 'Espèces').reduce((a, r) => a + r.amount, 0),
          )}
          icon={Banknote}
          note="Inclus dans le volume total"
        />
      </div>
      <div className="notice">
        <Wallet size={20} />
        <div>
          <strong>La clarté, jusqu’au dernier dirham.</strong>
          <span>
            Cette vue illustre les montants des courses de démonstration. Aucun transfert bancaire
            réel.
          </span>
        </div>
      </div>
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Les mouvements récents</h2>
            <p>Commissions et revenus par course terminée</p>
          </div>
          <button
            className="button button-outline button-small"
            onClick={() =>
              exportCsv(
                'naya-reconciliation',
                rides.map((r) => ({
                  Course: r.id,
                  Chauffeuse: r.driver,
                  Brut_MAD: r.amount,
                  Commission_MAD: Number(((r.amount * commission) / 100).toFixed(2)),
                  Net_MAD: Number((r.amount * (1 - commission / 100)).toFixed(2)),
                })),
              )
            }
          >
            <Download size={14} />
            Exporter
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Chauffeuse</th>
                <th>Paiement</th>
                <th className="text-right">Montant</th>
                <th className="text-right">Commission</th>
                <th className="text-right">Net chauffeuse</th>
              </tr>
            </thead>
            <tbody>
              {rides.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button className="reference" onClick={() => onSelect(r)}>
                      {r.id}
                    </button>
                  </td>
                  <td>{r.driver}</td>
                  <td>
                    <span className="payment-method">
                      {r.method === 'Carte' ? <CreditCard size={14} /> : <Banknote size={14} />}{' '}
                      {r.method}
                    </span>
                  </td>
                  <td className="text-right">{money(r.amount)}</td>
                  <td className="text-right">{((r.amount * commission) / 100).toFixed(2)} MAD</td>
                  <td className="text-right amount">
                    {(r.amount * (1 - commission / 100)).toFixed(2)} MAD
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rides.length && (
            <Empty
              title="Aucun mouvement"
              description="Les courses terminées de cette ville apparaîtront ici."
            />
          )}
        </div>
      </div>
    </>
  );
}
function Settings() {
  const store = useNaya(),
    [commission, setCommission] = useState(store.commission),
    [open, setOpen] = useState(store.serviceOpen);
  useEffect(() => {
    setCommission(store.commission);
    setOpen(store.serviceOpen);
  }, [store.commission, store.serviceOpen]);
  return (
    <form
      className="panel settings-panel"
      onSubmit={(e) => {
        e.preventDefault();
        store.saveSettings(commission, open);
      }}
    >
      <div className="panel-heading">
        <div>
          <h2>Paramètres du service</h2>
          <p>Des réglages simples pour vos opérations</p>
        </div>
        <Settings2 size={18} />
      </div>
      <div className="settings-row">
        <div>
          <h3>Commission Naya</h3>
          <p>Appliquée aux courses terminées dans la vue finance.</p>
        </div>
        <label className="percentage-input">
          <input
            aria-label="Commission en pourcentage"
            type="number"
            min={0}
            max={50}
            step={1}
            required
            value={commission}
            onChange={(e) => setCommission(Number(e.target.value))}
          />
          <span>%</span>
        </label>
      </div>
      <div className="settings-row">
        <div>
          <h3>Réservations à Rabat</h3>
          <p>Activer ou suspendre les nouveaux départs du prototype.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-label="Activer les réservations"
          className={`toggle ${open ? 'on' : ''}`}
          onClick={() => setOpen(!open)}
        >
          <span />
        </button>
      </div>
      <div className="settings-row">
        <div>
          <h3>Fuseau horaire</h3>
          <p>Tous les trajets suivent l’heure locale de Rabat.</p>
        </div>
        <span className="settings-value">Africa/Casablanca</span>
      </div>
      <div className="settings-row">
        <div>
          <h3>Devise</h3>
          <p>Une seule devise pour toutes vos opérations.</p>
        </div>
        <span className="settings-value">Dirham marocain · MAD</span>
      </div>
      <div className="settings-save">
        <span>Les modifications sont enregistrées dans ce navigateur.</span>
        <button className="button button-plum button-small">
          Enregistrer <Check size={16} />
        </button>
      </div>
    </form>
  );
}
function DetailModal({ detail, onClose }: { detail: Ride | Driver | Ticket; onClose: () => void }) {
  const s = useNaya(),
    [intent, setIntent] = useState<'cancel' | 'reject' | null>(null);
  const current =
    'passenger' in detail
      ? (s.rides.find((r) => r.id === detail.id) ?? detail)
      : 'vehicle' in detail
        ? (s.drivers.find((d) => d.id === detail.id) ?? detail)
        : (s.tickets.find((t) => t.id === detail.id) ?? detail);
  return (
    <Modal
      drawer
      title={
        'passenger' in current
          ? `Course ${current.id}`
          : 'vehicle' in current
            ? current.name
            : current.subject
      }
      onClose={onClose}
    >
      {intent ? (
        <ActionConfirmation
          title={intent === 'cancel' ? 'Annuler cette course ?' : 'Refuser cette candidature ?'}
          description={
            intent === 'cancel'
              ? 'La course sera retirée des trajets actifs. Vérifiez le motif avant de confirmer.'
              : 'Le compte ne pourra pas être activé. Expliquez les éléments manquants ou non conformes.'
          }
          confirmLabel={intent === 'cancel' ? 'Confirmer l’annulation' : 'Confirmer le refus'}
          onCancel={() => setIntent(null)}
          onConfirm={(reason) => {
            if (intent === 'cancel') s.updateRide(current.id, 'Annulée', reason);
            else s.verifyDriver(current.id, false, reason);
            onClose();
          }}
        />
      ) : 'passenger' in current ? (
        <>
          <div className="detail-top">
            <Badge>{current.status}</Badge>
            <span>
              {current.date} · {current.time}
            </span>
          </div>
          <div className="detail-route">
            <div>
              <span className="route-dot" />
              <div>
                <small>DÉPART</small>
                <strong>{current.from}</strong>
              </div>
            </div>
            <div>
              <MapPin size={17} />
              <div>
                <small>DESTINATION</small>
                <strong>{current.to}</strong>
              </div>
            </div>
          </div>
          <div className="detail-people">
            <div>
              <Avatar name={current.passenger} />
              <span>
                <small>Passagère</small>
                <strong>{current.passenger}</strong>
              </span>
            </div>
            <div>
              <Avatar name={current.driver} />
              <span>
                <small>Chauffeuse</small>
                <strong>{current.driver}</strong>
              </span>
            </div>
          </div>
          <div className="quote-panel">
            <div>
              <span>Montant de la course</span>
              <strong>{money(current.amount)}</strong>
            </div>
            <span>Paiement par {current.method.toLowerCase()}</span>
          </div>
          {current.status === 'En cours' || current.status === 'Planifiée' ? (
            <div className="detail-actions">
              <button
                className="button button-outline"
                onClick={() => {
                  setIntent('cancel');
                }}
              >
                Annuler la course
              </button>
              <button
                className="button button-plum"
                onClick={() => {
                  s.updateRide(
                    current.id,
                    current.status === 'Planifiée' ? 'En cours' : 'Terminée',
                  );
                  onClose();
                }}
              >
                {current.status === 'Planifiée' ? 'Démarrer' : 'Terminer'} <Check size={15} />
              </button>
            </div>
          ) : (
            <p className="prototype-note">
              Cette course a été {current.status.toLowerCase()}.{' '}
              {current.cancellationReason && `Motif : ${current.cancellationReason}.`} Retrouvez les
              mouvements dans Finance.
            </p>
          )}
        </>
      ) : 'vehicle' in current ? (
        <>
          <div className="profile-heading">
            <Avatar name={current.name} size={54} />
            <div>
              <h3>{current.name}</h3>
              <p>{current.phone}</p>
            </div>
            <Badge>{current.status}</Badge>
          </div>
          <div className="detail-info">
            <span>
              Véhicule<strong>{current.vehicle}</strong>
            </span>
            <span>
              Immatriculation<strong>{current.plate}</strong>
            </span>
            <span>
              Ville<strong>{current.city}</strong>
            </span>
            <span>
              Courses réalisées<strong>{current.rides}</strong>
            </span>
          </div>
          {current.status === 'À vérifier' ? (
            <>
              <ReviewDocuments driver={current} />
              <div className="detail-actions">
                <button
                  className="button button-outline"
                  onClick={() => {
                    setIntent('reject');
                  }}
                >
                  Refuser le dossier
                </button>
                <button
                  className="button button-plum"
                  disabled={(Object.keys(documentLabels) as DocumentKey[]).some(
                    (key) => current.documents?.[key] !== 'Accepté',
                  )}
                  onClick={() => {
                    s.verifyDriver(current.id, true);
                    onClose();
                  }}
                >
                  Valider le dossier <Check size={15} />
                </button>
              </div>
            </>
          ) : current.status === 'Refusée' ? (
            <p className="prototype-note">
              Ce dossier a été refusé. Motif : {current.rejectionReason ?? 'Non renseigné'}.
            </p>
          ) : (
            <button
              className="button button-plum w-full"
              onClick={() => {
                s.setDriverOnline(current.id, current.status !== 'En ligne');
                onClose();
              }}
            >
              {current.status === 'En ligne' ? 'Passer hors ligne' : 'Passer en ligne'}
              <ArrowRight size={16} />
            </button>
          )}
        </>
      ) : (
        <>
          <SupportDetail ticket={current} />
        </>
      )}
    </Modal>
  );
}
function NewRide({ onClose }: { onClose: () => void }) {
  const s = useNaya(),
    [name, setName] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [driver, setDriver] = useState(s.drivers.find((d) => d.status === 'En ligne')?.name ?? ''),
    [amount, setAmount] = useState(50);
  const eligible = s.drivers.filter((d) => d.status === 'En ligne' && d.city === s.city);
  return (
    <Modal title="Un nouveau départ" onClose={onClose}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          const id = s.addRide({
            passenger: name,
            driver,
            from,
            to,
            amount,
            status: 'En cours',
            time: new Date().toLocaleTimeString('fr-MA', {
              timeZone: 'Africa/Casablanca',
              hour: '2-digit',
              minute: '2-digit',
            }),
            method: 'Carte',
            city: s.city,
          });
          s.notify(`Course ${id} créée. Bon départ !`);
          onClose();
        }}
      >
        <p className="modal-description">Créez une course de démonstration pour votre équipe.</p>
        <label className="field-label">
          Passagère
          <input
            className="input"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Prénom et nom"
          />
        </label>
        <label className="field-label">
          Départ
          <input
            className="input"
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="Adresse de départ"
          />
        </label>
        <label className="field-label">
          Destination
          <input
            className="input"
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Adresse d’arrivée"
          />
        </label>
        <div className="form-grid">
          <label className="field-label">
            Chauffeuse
            <select
              className="input"
              required
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
            >
              {eligible.map((d) => (
                <option key={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Montant (MAD)
            <input
              className="input"
              type="number"
              min={1}
              max={5000}
              required
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
        </div>
        {!eligible.length && (
          <p className="field-error">Aucune chauffeuse en ligne dans cette ville.</p>
        )}
        <button className="button button-plum w-full" disabled={!eligible.length || !s.serviceOpen}>
          Créer la course <Plus size={16} />
        </button>
      </form>
    </Modal>
  );
}
