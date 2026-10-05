'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronRight,
  FileText,
  Headphones,
  ShieldCheck,
  Check,
  Clock3,
} from 'lucide-react';
import { documentLabels, useNaya, type Driver, type Ticket, type DocumentKey } from '@/lib/store';
import { Avatar, Badge, Empty } from './ui';

function receivedAt(item: Driver | Ticket) {
  return (
    item.createdAt ??
    ('subject' in item
      ? `2026-10-05T${item.priority === 'Haute' ? '09:15' : '10:25'}:00+01:00`
      : '2026-10-05T08:30:00+01:00')
  );
}

function ReceivedTime({ value }: { value: string }) {
  // Format after hydration: server and embedded-browser timezone databases can differ.
  const [text, setText] = useState(
    `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`,
  );
  useEffect(() => {
    setText(
      new Date(value).toLocaleString('fr-MA', {
        timeZone: 'Africa/Casablanca',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    );
  }, [value]);
  return <time dateTime={value}>{text}</time>;
}

export function WorkQueue({
  drivers,
  tickets,
  onSelect,
}: {
  drivers: Driver[];
  tickets: Ticket[];
  onSelect: (item: Driver | Ticket) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = [
    ...tickets.filter((t) => t.status !== 'Résolu'),
    ...drivers.filter((d) => d.status === 'À vérifier'),
  ].sort((a, b) => {
    const rank = (item: Driver | Ticket) =>
      'subject' in item ? (item.priority === 'Haute' ? 0 : 2) : 1;
    return (
      rank(a) - rank(b) || receivedAt(a).localeCompare(receivedAt(b)) || a.id.localeCompare(b.id)
    );
  });
  return (
    <section className="panel work-queue" aria-labelledby="queue-heading">
      <div className="panel-heading">
        <div>
          <span className="queue-eyebrow">VOTRE PROCHAINE ACTION</span>
          <h2 id="queue-heading">
            À traiter en priorité <span className="count-badge">{items.length}</span>
          </h2>
          <p>Les demandes urgentes d’abord. Les dossiers en attente ensuite.</p>
        </div>
        <div className="queue-links">
          <Link href="/backoffice/support">
            Support <ArrowRight size={15} />
          </Link>
          <Link href="/backoffice/verifications">
            Dossiers <ArrowRight size={15} />
          </Link>
        </div>
      </div>
      {!items.length ? (
        <Empty title="Tout est à jour" description="Aucune demande en attente dans cette ville." />
      ) : (
        <>
          <div className="queue-items">
            {(expanded ? items : items.slice(0, 4)).map((item) => {
              const ticket = 'subject' in item;
              return (
                <button
                  className={`queue-item ${ticket && item.priority === 'Haute' ? 'urgent' : ''}`}
                  key={item.id}
                  onClick={() => onSelect(item)}
                >
                  <span className="priority-icon">
                    {ticket ? <Headphones size={20} /> : <ShieldCheck size={20} />}
                  </span>
                  <span className="queue-item-copy">
                    <strong>{ticket ? item.subject : item.name}</strong>
                    <span>{ticket ? `${item.name} · ${item.id}` : 'Candidature à examiner'}</span>
                    <small>
                      <Clock3 size={12} /> Reçue le <ReceivedTime value={receivedAt(item)} />
                    </small>
                  </span>
                  <Badge>
                    {ticket ? (item.priority === 'Haute' ? 'Haute' : item.status) : 'À vérifier'}
                  </Badge>
                  <ChevronRight size={18} />
                </button>
              );
            })}
          </div>
          {items.length > 4 && (
            <button
              className="queue-expand"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Réduire la liste' : `Voir les ${items.length} demandes`}{' '}
              <ArrowRight size={16} />
            </button>
          )}
        </>
      )}
    </section>
  );
}

export function ActionConfirmation({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <form
      className="action-confirmation"
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm(reason.trim());
      }}
    >
      <span className="eyebrow">VÉRIFIER AVANT DE CONFIRMER</span>
      <h3>{title}</h3>
      <p>{description}</p>
      <label className="field-label">
        Motif de la décision
        <textarea
          className="input"
          rows={3}
          required
          minLength={5}
          autoFocus
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Expliquez la décision à votre équipe…"
        />
      </label>
      <p className="prototype-note">Le motif sera conservé dans le journal d’activité.</p>
      <div className="detail-actions">
        <button type="button" className="button button-outline" onClick={onCancel}>
          Revenir aux détails
        </button>
        <button className="button button-danger" disabled={reason.trim().length < 5}>
          {confirmLabel}
        </button>
      </div>
    </form>
  );
}

export function ReviewDocuments({ driver }: { driver: Driver }) {
  const review = useNaya((s) => s.reviewDocument);
  return (
    <div className="review-documents">
      <p className="prototype-note">
        Spécimens fictifs. Examinez chaque pièce avant de valider la candidature.
      </p>
      {(Object.keys(documentLabels) as DocumentKey[]).map((key) => {
        const status = driver.documents?.[key] ?? 'À examiner';
        return (
          <details className="review-document" key={key}>
            <summary>
              <FileText size={18} />
              <strong>{documentLabels[key]}</strong>
              <Badge>{status}</Badge>
            </summary>
            <div className="document-specimen">
              <span>SPÉCIMEN DE DÉMONSTRATION</span>
              <h4>{documentLabels[key]}</h4>
              <p>{driver.name}</p>
              <p>
                {key === 'vehicle'
                  ? `${driver.vehicle} · ${driver.plate}`
                  : 'Pièce fictive · Dossier Naya Maroc'}
              </p>
              <small>
                Dans le produit final, la pièce déposée serait affichée ici. Ces informations
                n’attestent aucune vérification réelle.
              </small>
            </div>
            <div className="document-actions">
              <button
                className="button button-outline"
                aria-label={`Demander un complément : ${documentLabels[key]}`}
                onClick={() => review(driver.id, key, 'À compléter')}
              >
                À compléter
              </button>
              <button
                className="button button-plum"
                disabled={status === 'Accepté'}
                aria-label={`Accepter : ${documentLabels[key]}`}
                onClick={() => review(driver.id, key, 'Accepté')}
              >
                <Check size={15} /> {status === 'Accepté' ? 'Accepté' : 'Accepter la pièce'}
              </button>
            </div>
          </details>
        );
      })}
    </div>
  );
}

export function SupportDetail({ ticket }: { ticket: Ticket }) {
  const replyTicket = useNaya((s) => s.replyTicket),
    resolve = useNaya((s) => s.resolveTicket),
    update = useNaya((s) => s.updateTicket);
  const [reply, setReply] = useState('');
  const responses = ticket.responses ?? (ticket.reply ? [{ body: ticket.reply, date: '' }] : []);
  return (
    <>
      <div className="detail-top">
        <Badge>{ticket.status}</Badge>
        <span>{ticket.id}</span>
      </div>
      <div className="support-metadata">
        <label className="field-label">
          Priorité
          <select
            className="input"
            value={ticket.priority}
            onChange={(e) => update(ticket.id, { priority: e.target.value })}
          >
            <option>Normale</option>
            <option>Haute</option>
          </select>
        </label>
        <label className="field-label">
          Assignée à
          <select
            className="input"
            value={ticket.assignee ?? 'Non assignée'}
            onChange={(e) => update(ticket.id, { assignee: e.target.value })}
          >
            <option>Non assignée</option>
            <option>Meryem Bennis</option>
            <option>Équipe support</option>
          </select>
        </label>
      </div>
      <p className="support-received">
        Reçue le{' '}
        {new Date(receivedAt(ticket)).toLocaleString('fr-MA', {
          timeZone: 'Africa/Casablanca',
          day: '2-digit',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
      <div className="ticket-message">
        <Avatar name={ticket.name} />
        <div>
          <strong>{ticket.name}</strong>
          <p>{ticket.message}</p>
        </div>
      </div>
      {responses.map((response, index) => (
        <div className="ticket-reply" key={`${response.date}-${index}`}>
          <strong>
            Réponse de l’équipe{' '}
            {response.date && (
              <small>
                ·{' '}
                {new Date(response.date).toLocaleTimeString('fr-MA', {
                  timeZone: 'Africa/Casablanca',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </small>
            )}
          </strong>
          <p>{response.body}</p>
        </div>
      ))}
      {ticket.status !== 'Résolu' ? (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              replyTicket(ticket.id, reply.trim());
              setReply('');
            }}
          >
            <label className="field-label">
              Votre réponse
              <textarea
                className="input"
                rows={4}
                required
                minLength={5}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder="Bonjour, nous sommes là pour vous aider…"
              />
            </label>
            <button className="button button-plum w-full" disabled={reply.trim().length < 5}>
              Enregistrer la réponse <ArrowRight size={16} />
            </button>
          </form>
          <p className="prototype-note">
            Réponse enregistrée localement. Aucun message n’est envoyé.
          </p>
          <div className="resolve-ticket">
            <span>Le problème est réglé ?</span>
            <button className="button button-outline" onClick={() => resolve(ticket.id)}>
              Marquer comme résolu <Check size={15} />
            </button>
          </div>
        </>
      ) : (
        <p className="prototype-note">
          Cette demande est résolue. Son historique reste disponible.
        </p>
      )}
    </>
  );
}
