// llm_stub.ts — stubbed translation LLM.
//
// Given the segmented transcript + a target language, streams the
// translation back chunk by chunk. Replaced at grade time by a real LLM
// (Anthropic or OpenAI). Your code should depend only on the public API.

import type { Transcript, LanguageCode } from "./types"

// Pre-baked translations for each sample utterance. The grader replaces
// this with a real LLM call.
const FAKE_TRANSLATIONS: Record<string, Partial<Record<LanguageCode, string>>> = {
  u1: {
    en: "Today I had a meeting with my manager, and he said the deadline is next Friday.",
    zh: "我今天和我的经理开了个会，他说截止日期是下周五。",
    es: "Hoy tuve una reunión con mi gerente, y dijo que la fecha límite es el viernes que viene.",
    hi: "आज मेरी अपने मैनेजर से मीटिंग हुई, उसने कहा डेडलाइन अगले शुक्रवार है।",
    fr: "Aujourd'hui j'ai eu une réunion avec mon manager, et il a dit que la date limite est vendredi prochain.",
  },
  u2: {
    en: "So like, this weekend I'm going to the beach with my family.",
    zh: "嗯，这个周末我要和家人去海边。",
    es: "Entonces, este fin de semana voy a la playa con mi familia.",
    hi: "तो, इस वीकेंड मैं अपनी फैमिली के साथ बीच जा रहा हूँ।",
    fr: "Genre, ce weekend je vais à la plage avec ma famille.",
  },
  u3: {
    en: "I'd like a butter chicken and a bit of naan, please.",
    zh: "我想要一份黄油鸡和一点烤饼。",
    es: "Quisiera un pollo a la mantequilla y un poco de pan naan, por favor.",
    hi: "मुझे एक बटर चिकन और थोड़ा सा नान ले लेना है।",
    fr: "Je voudrais un butter chicken et un peu de naan, s'il vous plaît.",
  },
  u4: {
    en: "This morning I had a really intense workout at the gym.",
    zh: "今早我在健身房做了一次非常强烈的训练。",
    es: "Esta mañana tuve un entrenamiento muy intenso en el gimnasio.",
    hi: "आज सुबह मैंने जिम में एक बहुत इंटेंस वर्कआउट किया।",
    fr: "Ce matin j'ai eu un entraînement très intense au club de sport.",
  },
  u5: {
    en: "I looked at the PR and I think the abstraction is leaking. For example, the controller knows about the database schema directly.",
    zh: "我看了一下这个 PR，我觉得抽象在泄漏。比如说，controller 直接知道数据库的 schema。",
    es: "Miré el PR y creo que la abstracción se está filtrando. Por ejemplo, el controlador conoce directamente el esquema de la base de datos.",
    hi: "मैंने PR देखा और मुझे लगता है abstraction लीक हो रहा है। जैसे कि controller को database schema की सीधी जानकारी है।",
    fr: "J'ai regardé la PR et je pense que l'abstraction fuit. Par exemple, le contrôleur connaît directement le schéma de la base de données.",
  },
  u6: {
    en: "Good morning. Yesterday I finished the auth migration without issues. Today I'm working on the rate limiter.",
    zh: "早上好。昨天我顺利完成了 auth migration，今天在做 rate limiter。",
    es: "Buenos días. Ayer terminé la migración de auth sin problemas. Hoy estoy trabajando en el rate limiter.",
    hi: "गुड मॉर्निंग। कल मैंने auth migration बिना किसी प्रॉब्लम के पूरा कर लिया। आज rate limiter पर काम कर रहा हूँ।",
    fr: "Bonjour. Hier j'ai fini la migration auth sans problème. Aujourd'hui je travaille sur le rate limiter.",
  },
}

export interface TranslationStream {
  chunks: AsyncIterable<string>
}

export function translate(transcript: Transcript, target: LanguageCode): TranslationStream {
  const fake = FAKE_TRANSLATIONS[transcript.id]?.[target]

  async function* stream(): AsyncIterable<string> {
    if (!fake) {
      yield `(stub: no translation cached for transcript=${transcript.id} target=${target})`
      return
    }
    // Stream chunk-by-chunk: split on whitespace, keep separators.
    const chunks = fake.split(/(\s+)/)
    for (const c of chunks) {
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 80))
      yield c
    }
  }

  return { chunks: stream() }
}
