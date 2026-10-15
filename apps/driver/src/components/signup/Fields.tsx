import { themedStyles, colors } from '@naya/tokens';
import { useTheme, DateField, DocumentPicker, FieldRow, FormField, ID_DOCUMENTS, IconButton, Pill, PressableScale, Text, haptic, type IdDocumentType } from '@naya/ui';
import { StyleSheet, View } from 'react-native';
import { BookOpenCheck, Building2, Check, Hash, MapPin, Minus, Phone, Plus, ShieldCheck, UserRound } from 'lucide-react-native';
import { COUNTRIES, formatNational, interviewDays, toE164, type QuestionStepId, type SignupContext, type SignupDraft } from '@naya/domain';
import { ChoiceRow } from '../Kit';
import { INTERVIEW_WINDOWS, formatShortDay } from './copy';

export type Answers = SignupDraft;
type Set = <K extends keyof Answers>(k: K, v: Answers[K]) => void;
type Errors = Partial<Record<keyof Answers, string>>;

const MA = COUNTRIES[0]!;
const CITIES = ['Rabat', 'Salé', 'Témara', 'Skhirat'];
const MAKES = ['Dacia', 'Renault', 'Peugeot', 'Hyundai', 'Toyota', 'Kia'];
const COLOURS = ['Blanc', 'Gris', 'Noir', 'Bleu', 'Rouge', 'Beige'];
const CATEGORIES = ['A', 'B', 'C', 'D'];

/** Moroccan mobile entry: shows the national format, stores E.164 once complete. */
function MobileField({ label, value, onChange, error, testID }: { label: string; value?: string; onChange: (v: string) => void; error?: string; testID?: string }) {
  useTheme();
  const shown = value?.startsWith(MA.dial) ? formatNational(MA, value.slice(MA.dial.length)) : (value ?? '');
  return (
    <FormField
      label={label}
      icon={Phone}
      value={shown}
      onChangeText={(t) => onChange(toE164(MA, t) ?? t.replace(/[^\d ]/g, ''))}
      keyboardType="phone-pad"
      textContentType="telephoneNumber"
      placeholder={MA.example}
      error={error}
      leading={
        <Text variant="label" weight="semibold" tone="muted">
          {MA.dial}
        </Text>
      }
      testID={testID}
    />
  );
}

/** Whole years with − / + discs (44 pt) and quick picks. */
function YearsStepper({ value, onChange, error, label, testID }: { value?: number; onChange: (v: number) => void; error?: string; label: string; testID?: string }) {
  useTheme();
  const v = value ?? 0;
  const set = (n: number) => {
    haptic.select();
    onChange(Math.max(0, Math.min(60, n)));
  };
  return (
    <View style={{ gap: 14 }}>
      <View style={[styles.stepper, error ? { borderColor: colors.danger, borderWidth: 1.5 } : null]} accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 60, now: v, text: `${v} an${v > 1 ? 's' : ''}` }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={(e) => set(e.nativeEvent.actionName === 'increment' ? v + 1 : v - 1)} testID={testID}>
        <IconButton icon={<Minus size={20} color={colors.accent} />} variant="tonal" accessibilityLabel="Une année de moins" onPress={() => set(v - 1)} disabled={v <= 0} testID={testID ? `${testID}-minus` : undefined} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text variant="display" numeric>
            {v}
          </Text>
          <Text variant="caption" tone="muted">
            {v > 1 ? 'années' : 'année'}
          </Text>
        </View>
        <IconButton icon={<Plus size={20} color={colors.accent} />} variant="tonal" accessibilityLabel="Une année de plus" onPress={() => set(v + 1)} disabled={v >= 60} testID={testID ? `${testID}-plus` : undefined} />
      </View>
      <View style={styles.pills}>
        {[1, 2, 3, 5, 10].map((n) => (
          <Pill key={n} label={n === 10 ? '10 ans et +' : `${n} an${n > 1 ? 's' : ''}`} selected={v === n} onPress={() => onChange(n)} testID={testID ? `${testID}-${n}` : undefined} />
        ))}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ marginLeft: 18 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** A labelled, checkable commitment (training acknowledgement). */
function Commitment({ checked, onToggle, error }: { checked: boolean; onToggle: () => void; error?: string }) {
  useTheme();
  return (
    <View style={{ gap: 6 }}>
      <PressableScale onPress={onToggle} pressedScale={0.985} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel="Je m’engage à suivre la formation Naya Famille avant mon premier trajet avec un enfant" style={[styles.commit, checked ? { borderColor: colors.accent, borderWidth: 1.5 } : null, error && !checked ? { borderColor: colors.danger, borderWidth: 1.5 } : null]} testID="training-ack">
        <View style={[styles.box, checked ? { backgroundColor: colors.accent, borderColor: colors.accent } : null]}>{checked ? <Check size={15} color={colors.inverse} strokeWidth={3} /> : null}</View>
        <Text variant="label" style={{ flex: 1 }}>
          Je m’engage à suivre la formation Naya Famille avant mon premier trajet avec un enfant.
        </Text>
      </PressableScale>
      {error && !checked ? (
        <Text variant="caption" tone="danger" accessibilityRole="alert" style={{ marginLeft: 18 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const TRAINING = [
  { icon: ShieldCheck, title: 'Sécurité de l’enfant', detail: 'Sièges auto, ceintures, portières verrouillées' },
  { icon: UserRound, title: 'Remise à un adulte autorisé', detail: 'Code de remise, photo d’arrivée, que faire en cas de doute' },
  { icon: BookOpenCheck, title: 'Règles de conduite Naya Famille', detail: 'Ponctualité, communication avec les parents, urgence' },
];

/** The fields of one question step. Values live in the parent so the draft can be merged and saved. */
export function QuestionFields({ id, answers, set, errors, ctx }: { id: QuestionStepId; answers: Answers; set: Set; errors: Errors; ctx: SignupContext }) {
  useTheme();
  const a = answers;
  switch (id) {
    case 'name':
      return (
        <FieldRow>
          <FormField icon={UserRound} label="Prénom" value={a.firstName ?? ''} onChangeText={(t) => set('firstName', t)} error={errors.firstName} autoComplete="given-name" textContentType="givenName" autoFocus testID="first-name" />
          <FormField label="Nom" value={a.lastName ?? ''} onChangeText={(t) => set('lastName', t)} error={errors.lastName} autoComplete="family-name" textContentType="familyName" testID="last-name" />
        </FieldRow>
      );
    case 'birth':
      return <DateField label="Date de naissance" value={a.birthDate ?? ''} onChange={(v) => set('birthDate', v)} error={errors.birthDate} testID="birth-date" />;
    case 'address':
      return (
        <View style={{ gap: 12 }}>
          <FormField icon={MapPin} label="Adresse" placeholder="N°, rue, quartier" value={a.address ?? ''} onChangeText={(t) => set('address', t)} error={errors.address} autoComplete="street-address" textContentType="fullStreetAddress" testID="address" />
          <FormField icon={Building2} label="Ville" value={a.city ?? ''} onChangeText={(t) => set('city', t)} error={errors.city} autoComplete="postal-address-locality" textContentType="addressCity" testID="city" />
          <View style={styles.pills}>
            {CITIES.map((c) => (
              <Pill key={c} label={c} selected={a.city === c} onPress={() => set('city', c)} testID={`city-${c}`} />
            ))}
          </View>
        </View>
      );
    case 'id_document': {
      const type = (a.documentType ?? 'cin') as IdDocumentType;
      return (
        <View style={{ gap: 12 }}>
          <DocumentPicker value={type} onChange={(v) => set('documentType', v)} testID="document-type" />
          <FormField icon={Hash} label={ID_DOCUMENTS[type].numberLabel} placeholder={ID_DOCUMENTS[type].example} value={a.documentNumber ?? ''} onChangeText={(t) => set('documentNumber', t.toUpperCase().replace(/\s/g, ''))} error={errors.documentNumber} autoCapitalize="characters" autoCorrect={false} testID="document-number" />
        </View>
      );
    }
    case 'licence_number':
      return (
        <View style={{ gap: 14 }}>
          <FormField icon={Hash} label="Numéro du permis" placeholder="Ex. 12/345678" value={a.licenceNumber ?? ''} onChangeText={(t) => set('licenceNumber', t.toUpperCase().replace(/\s/g, ''))} error={errors.licenceNumber} autoCapitalize="characters" autoCorrect={false} testID="licence-number" />
          <View style={{ gap: 8 }}>
            <Text variant="caption" tone="muted" style={{ marginLeft: 4 }}>
              Catégorie
            </Text>
            <View style={styles.pills} accessibilityRole="radiogroup" accessibilityLabel="Catégorie du permis">
              {CATEGORIES.map((c) => (
                <Pill key={c} label={c === 'B' ? 'B · voiture' : c} selected={a.licenceCategory === c} onPress={() => set('licenceCategory', c)} testID={`category-${c}`} />
              ))}
            </View>
            {errors.licenceCategory ? (
              <Text variant="caption" tone="danger" accessibilityRole="alert" style={{ marginLeft: 4 }}>
                {errors.licenceCategory}
              </Text>
            ) : null}
          </View>
        </View>
      );
    case 'licence_dates':
      return (
        <View style={{ gap: 12 }}>
          <DateField label="Date de délivrance" value={a.licenceIssueDate ?? ''} onChange={(v) => set('licenceIssueDate', v)} error={errors.licenceIssueDate} testID="licence-issue" />
          <DateField label="Date d’expiration" value={a.licenceExpiryDate ?? ''} onChange={(v) => set('licenceExpiryDate', v)} error={errors.licenceExpiryDate} testID="licence-expiry" />
        </View>
      );
    case 'experience':
      return <YearsStepper label="Années de conduite" value={a.experienceYears} onChange={(v) => set('experienceYears', v)} error={errors.experienceYears} testID="experience" />;
    case 'vehicle_model':
      return (
        <View style={{ gap: 12 }}>
          <FieldRow>
            <FormField label="Marque" value={a.make ?? ''} onChangeText={(t) => set('make', t)} error={errors.make} testID="vehicle-make" />
            <FormField label="Modèle" value={a.model ?? ''} onChangeText={(t) => set('model', t)} error={errors.model} testID="vehicle-model" />
          </FieldRow>
          <View style={styles.pills}>
            {MAKES.map((m) => (
              <Pill key={m} label={m} selected={a.make === m} onPress={() => set('make', m)} />
            ))}
          </View>
          <FormField label="Année de mise en circulation" value={a.year ? String(a.year) : ''} onChangeText={(t) => set('year', Number(t.replace(/\D/g, '').slice(0, 4)) || undefined)} error={errors.year} keyboardType="number-pad" maxLength={4} testID="vehicle-year" />
        </View>
      );
    case 'vehicle_plate':
      return (
        <View style={{ gap: 12 }}>
          <FormField
            label="Immatriculation"
            placeholder="Ex. 12345-A-6"
            value={a.plate ?? ''}
            onChangeText={(t) => set('plate', t.toUpperCase())}
            error={errors.plate}
            autoCapitalize="characters"
            autoCorrect={false}
            leading={
              <View style={styles.plateBadge}>
                <Text variant="micro" weight="bold" tone="inverse">
                  MA
                </Text>
              </View>
            }
            inputStyle={{ letterSpacing: 1.5, fontFamily: 'Inter_600SemiBold' }}
            testID="vehicle-plate"
          />
          <FormField label="Couleur" value={a.color ?? ''} onChangeText={(t) => set('color', t)} error={errors.color} testID="vehicle-color" />
          <View style={styles.pills}>
            {COLOURS.map((c) => (
              <Pill key={c} label={c} selected={a.color === c} onPress={() => set('color', c)} />
            ))}
          </View>
        </View>
      );
    case 'famille_references':
      return (
        <View style={{ gap: 18 }}>
          {([1, 2] as const).map((n) => (
            <View key={n} style={{ gap: 10 }}>
              <Text variant="caption" weight="semibold" tone="muted" style={{ marginLeft: 4 }} accessibilityRole="header">
                Référence {n}
              </Text>
              <FormField icon={UserRound} label="Prénom et nom" value={a[`reference${n}Name`] ?? ''} onChangeText={(t) => set(`reference${n}Name`, t)} error={errors[`reference${n}Name`]} testID={`reference${n}-name`} />
              <MobileField label="Téléphone" value={a[`reference${n}Phone`]} onChange={(v) => set(`reference${n}Phone`, v)} error={errors[`reference${n}Phone`]} testID={`reference${n}-phone`} />
            </View>
          ))}
        </View>
      );
    case 'famille_experience':
      return (
        <View style={{ gap: 18 }}>
          <YearsStepper label="Années d’expérience avec des enfants" value={a.childExperienceYears} onChange={(v) => set('childExperienceYears', v)} error={errors.childExperienceYears} testID="child-years" />
          <FormField
            label="En quelques phrases"
            multiline
            value={a.childExperienceSummary ?? ''}
            onChangeText={(t) => set('childExperienceSummary', t)}
            error={errors.childExperienceSummary}
            helper={`${(a.childExperienceSummary ?? '').trim().length}/500 · 20 caractères minimum`}
            maxLength={500}
            testID="child-summary"
          />
        </View>
      );
    case 'famille_training':
      return (
        <View style={{ gap: 14 }}>
          <View style={styles.card}>
            {TRAINING.map(({ icon: Icon, title, detail }) => (
              <View key={title} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 6 }}>
                <Icon size={20} color={colors.accent} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text variant="label" weight="semibold">
                    {title}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {detail}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <Commitment checked={a.trainingAcknowledged === true} onToggle={() => set('trainingAcknowledged', !a.trainingAcknowledged)} error={errors.trainingAcknowledged} />
        </View>
      );
    case 'famille_interview': {
      const days = interviewDays(ctx.today, 6);
      return (
        <View style={{ gap: 18 }}>
          <View style={{ gap: 8 }}>
            <Text variant="caption" weight="semibold" tone="muted" style={{ marginLeft: 4 }}>
              Jour
            </Text>
            <View style={styles.pills} accessibilityRole="radiogroup" accessibilityLabel="Jour de l’entretien">
              {days.map((d) => (
                <Pill key={d} label={formatShortDay(d)} selected={a.interviewDay === d} onPress={() => set('interviewDay', d)} testID={`interview-day-${d}`} />
              ))}
            </View>
            {errors.interviewDay ? (
              <Text variant="caption" tone="danger" accessibilityRole="alert" style={{ marginLeft: 4 }}>
                {errors.interviewDay}
              </Text>
            ) : null}
          </View>
          <View style={{ gap: 10 }} accessibilityRole="radiogroup" accessibilityLabel="Moment de la journée">
            {(['morning', 'afternoon'] as const).map((w) => (
              <ChoiceRow key={w} title={INTERVIEW_WINDOWS[w].label} subtitle={INTERVIEW_WINDOWS[w].detail} selected={a.interviewWindow === w} onPress={() => set('interviewWindow', w)} testID={`interview-${w}`} />
            ))}
            {errors.interviewWindow ? (
              <Text variant="caption" tone="danger" accessibilityRole="alert" style={{ marginLeft: 4 }}>
                {errors.interviewWindow}
              </Text>
            ) : null}
          </View>
        </View>
      );
    }
  }
}

const styles = themedStyles(() =>
  StyleSheet.create({
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: colors.hairline },
    commit: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: 22, padding: 16, minHeight: 64, borderWidth: 1, borderColor: colors.hairline },
    box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.outline, alignItems: 'center', justifyContent: 'center' },
    card: { backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: colors.hairline },
    plateBadge: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginLeft: -6 },
  }),
);
