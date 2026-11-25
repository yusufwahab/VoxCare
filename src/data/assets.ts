/** Typed catalogue of every picture and clip. All paths live under /assets/voxcare/. */
export const BASE = '/assets/voxcare'

export interface Asset {
  id: string
  src: string
  poster?: string
  /** Patient label, 1-3 words */
  label: string
  /** First-person clause used by the sentence builder */
  sentence: string
  /** Text shown to the doctor */
  doctorText: string
  /** For "have" items: a noun phrase that can be grouped ("a fever, chills and a rash") */
  phrase?: string
}

const img = (folder: string, id: string) => `${BASE}/${folder}/${id}.webp`
const clip = (folder: string, id: string) => `${BASE}/${folder}/${id}.mp4`
const poster = (folder: string, id: string) => `${BASE}/${folder}/${id}-poster.webp`

const pic = (folder: string, id: string, label: string, sentence: string, doctorText: string, phrase?: string): Asset => ({
  id, src: img(folder, id), label, sentence, doctorText, phrase,
})
const vid = (id: string, label: string, sentence: string, doctorText: string): Asset => ({
  id, src: clip('events', id), poster: poster('events', id), label, sentence, doctorText,
})

export const BODY = {
  front: img('body', 'body-front'),
  back: img('body', 'body-back'),
}

export const UI = {
  consentPrivate: img('ui', 'consent-private'),
  consentAllow: img('ui', 'consent-allow'),
  consentDelete: img('ui', 'consent-delete'),
  setupPhoto: img('ui', 'setup-photo'),
  setupDial: img('ui', 'setup-dial'),
  helpFamily: img('ui', 'help-family'),
  nfcTap: img('ui', 'nfc-tap'),
  introCard: img('ui', 'intro-card'),
  demoTap: clip('ui', 'demo-tap'),
  demoTapPoster: poster('ui', 'demo-tap'),
  practiceDone: img('ui', 'practice-done'),
  doctorGestures: img('ui', 'doctor-gestures'),
  talkDoctor: img('ui', 'talk-doctor'),
  doctorQuestions: img('ui', 'doctor-questions'),
  introDoctor: img('ui', 'intro-doctor'),
  introFamily: img('ui', 'intro-family'),
  hospitalTablet: img('ui', 'hospital-tablet'),
  pain: img('ui', 'pain'),
  allergyMedicine: img('ui', 'allergy-medicine'),
  other: img('ui', 'other'),
  consent: img('ui', 'consent'),
  photoCamera: img('ui', 'photo-camera'),
  photoGallery: img('ui', 'photo-gallery'),
}

/** "How bad": calm face to crying face */
export const LEVELS: Asset[] = [
  pic('feelings', 'level-0', 'No pain', 'It does not hurt much', 'No pain / very mild'),
  pic('feelings', 'level-1', 'A little', 'It is a little bad', 'Mild'),
  pic('feelings', 'level-2', 'Bad', 'It is bad', 'Moderate'),
  pic('feelings', 'level-3', 'Very bad', 'It is very bad', 'Severe'),
  pic('feelings', 'level-4', 'Worst', 'It is the worst pain I have had', 'Worst pain'),
]

export const FEELINGS: Asset[] = [
  pic('feelings', 'sad', 'Sad', 'I feel sad', 'Feels sad'),
  pic('feelings', 'worried', 'Worried', 'I feel worried', 'Feels worried'),
  pic('feelings', 'scared', 'Scared', 'I feel scared', 'Feels scared'),
  pic('feelings', 'angry', 'Angry', 'I feel angry', 'Feels angry'),
  pic('feelings', 'confused', 'Confused', 'I feel confused', 'Feels confused'),
  pic('facts', 'unsafe', 'Not safe', 'I do not feel safe', 'Does not feel safe'),
]

export const FEEL: Asset[] = [
  pic('feel', 'fever', 'Fever', 'I have a fever', 'Fever', 'a fever'),
  pic('feel', 'chills', 'Chills', 'I have chills', 'Chills', 'chills'),
  pic('feel', 'weak-tired', 'Weak, tired', 'I feel weak and tired', 'Weak and tired'),
  pic('feel', 'swelling-legs', 'Swollen legs', 'I have swelling in my legs', 'Swelling in legs', 'swelling in my legs'),
  pic('feel', 'swelling-face', 'Swollen face', 'I have swelling in my face', 'Swelling in face', 'swelling in my face'),
  pic('feel', 'rash', 'Rash', 'I have a rash', 'Skin rash', 'a rash'),
  pic('feel', 'itching', 'Itching', 'I have itching', 'Itching', 'itching'),
  pic('feel', 'nosebleed', 'Nosebleed', 'I have a nosebleed', 'Nosebleed', 'a nosebleed'),
  pic('feel', 'bleeding-cut', 'Bleeding cut', 'I have a bleeding cut', 'Bleeding cut', 'a bleeding cut'),
  pic('feel', 'cough', 'Cough', 'I have a cough', 'Cough', 'a cough'),
  pic('feel', 'diarrhoea', 'Running stomach', 'I have diarrhoea', 'Diarrhoea', 'diarrhoea'),
  pic('feel', 'no-appetite', 'No appetite', 'I do not want to eat', 'Loss of appetite'),
  pic('feel', 'cant-sleep', 'Cannot sleep', 'I cannot sleep', 'Cannot sleep'),
  pic('feel', 'blurred-vision', 'Blurred sight', 'My vision is blurred', 'Blurred vision'),
]

export const EVENTS: Asset[] = [
  vid('fall', 'I fell', 'I fell down', 'Had a fall'),
  vid('faint', 'I fainted', 'I fainted', 'Fainted'),
  vid('dizzy', 'Dizzy', 'I feel dizzy', 'Dizziness'),
  vid('breathless', 'Cannot breathe', 'I cannot breathe well', 'Shortness of breath'),
  vid('choking', 'Choking', 'I am choking', 'Choking'),
  vid('vomit', 'Vomiting', 'I have been vomiting', 'Vomiting'),
  vid('cough-blood', 'Coughing blood', 'I am coughing up blood', 'Coughing blood'),
  vid('stroke-signs', 'Face, arm weak', 'My face and arm feel weak on one side', 'Possible stroke signs'),
  vid('bladder', 'Bladder', 'I have a problem passing urine', 'Bladder or urine problem'),
]

export const FACTS: Asset[] = [
  pic('facts', 'pregnant', 'Pregnant', 'I am pregnant', 'Pregnant'),
  pic('facts', 'wheelchair', 'Wheelchair', 'I use a wheelchair', 'Uses a wheelchair'),
  pic('facts', 'walking-stick', 'Walking stick', 'I use a walking stick', 'Uses a walking stick'),
  pic('facts', 'crutches', 'Crutches', 'I use crutches', 'Uses crutches'),
  pic('facts', 'glasses', 'Glasses', 'I wear glasses', 'Wears glasses'),
  pic('facts', 'hearing-aid', 'Hearing aid', 'I use a hearing aid', 'Uses a hearing aid'),
  pic('facts', 'artificial-limb', 'Artificial limb', 'I have an artificial limb', 'Has an artificial limb'),
]

/** Doctor's picture questions (patient answers with tick or cross) */
export const QUESTIONS: Asset[] = [
  pic('questions', 'q-where', 'Where?', 'Where does it hurt?', 'Where does it hurt?'),
  pic('questions', 'q-how-long', 'How long?', 'How long has this been happening?', 'How long has this been happening?'),
  pic('questions', 'q-allergy', 'Allergy?', 'Are you allergic to any medicine?', 'Are you allergic to any medicine?'),
  pic('questions', 'q-medicine', 'On medicine?', 'Are you taking any medicine?', 'Are you taking any medicine?'),
  pic('questions', 'q-pregnant', 'Pregnant?', 'Are you pregnant?', 'Are you pregnant?'),
  pic('questions', 'q-eaten', 'Eaten today?', 'Have you eaten today?', 'Have you eaten today?'),
  pic('questions', 'q-fever', 'Fever?', 'Have you had a fever?', 'Have you had a fever?'),
  pic('questions', 'q-vomit', 'Vomiting?', 'Have you been vomiting?', 'Have you been vomiting?'),
  pic('questions', 'q-breathing', 'Hard to breathe?', 'Is it hard to breathe?', 'Is it hard to breathe?'),
  pic('questions', 'q-before', 'Before?', 'Has this happened before?', 'Has this happened before?'),
]

/** Doctor's picture instructions (patient answers "I understand") */
export const INSTRUCTIONS: Asset[] = [
  pic('questions', 'i-blood-test', 'Blood test', 'We need to take a blood test', 'We need to take a blood test.'),
  pic('questions', 'i-injection', 'Injection', 'You need an injection', 'You need an injection.'),
  pic('questions', 'i-xray', 'X-ray', 'You need an X-ray', 'You need an X-ray.'),
  pic('questions', 'i-medicine-twice', 'Twice a day', 'Take this medicine twice a day', 'Take this medicine twice a day.'),
  pic('questions', 'i-come-back', 'Come back', 'Please come back again', 'Please come back again.'),
]

export const CATEGORIES = {
  pain: { src: UI.pain, label: 'Pain' },
  feel: { src: img('feel', 'fever'), label: 'How I feel' },
  events: { src: poster('events', 'faint'), label: 'Something happened' },
  feelings: { src: img('feelings', 'worried'), label: 'Feelings' },
  allergy: { src: UI.allergyMedicine, label: 'Allergy or medicine' },
  other: { src: UI.other, label: 'Other' },
} as const

export const ALL_ASSETS: Asset[] = [...LEVELS, ...FEELINGS, ...FEEL, ...EVENTS, ...FACTS, ...QUESTIONS, ...INSTRUCTIONS]
export const byId = (id: string) => ALL_ASSETS.find((a) => a.id === id)

/** What the patient's tick or cross means for each picture question, as spoken first-person sentences */
export const ANSWERS: Record<string, { yes: string; no: string }> = {
  'q-allergy': { yes: 'Yes, I am allergic to a medicine.', no: 'No, I am not allergic to any medicine.' },
  'q-medicine': { yes: 'Yes, I am taking medicine.', no: 'No, I am not taking any medicine.' },
  'q-pregnant': { yes: 'Yes, I am pregnant.', no: 'No, I am not pregnant.' },
  'q-eaten': { yes: 'Yes, I have eaten today.', no: 'No, I have not eaten today.' },
  'q-fever': { yes: 'Yes, I have had a fever.', no: 'No, I have not had a fever.' },
  'q-vomit': { yes: 'Yes, I have been vomiting.', no: 'No, I have not been vomiting.' },
  'q-breathing': { yes: 'Yes, it is hard to breathe.', no: 'No, I can breathe fine.' },
  'q-before': { yes: 'Yes, this has happened before.', no: 'No, this has not happened before.' },
}
