import { createEmbed } from './embed.js';

// Images associées aux types de sanction
const sanctionImages = {
  warn: 'https://i.imgur.com/Warning.png',
  mute: 'https://i.imgur.com/Mute.png',
  unmute: 'https://i.imgur.com/Unmute.png',
};

export async function safeDM(user, content) {
  try {
    if (content.embeds || content.data) {
      await user.send({ embeds: content.embeds ? content.embeds : [content] });
    } else {
      const embed = createEmbed({ description: content });
      await user.send({ embeds: [embed] });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function humanizeMs(ms) {
  const s = Math.floor(ms/1000);
  const m = Math.floor(s/60);
  const h = Math.floor(m/60);
  const d = Math.floor(h/24);
  const parts = [];
  if (d) parts.push(`${d}j`);
  if (h%24) parts.push(`${h%24}h`);
  if (m%60) parts.push(`${m%60}m`);
  if (!parts.length) parts.push(`${s%60}s`);
  return parts.join(' ');
}

export function ts(ms) { return Math.floor(ms/1000); }

export function dmTemplates() {
  return {
    warn: ({ guild, reason, moderatorTag, nowTs }) => {
      return createEmbed({
        color: '#FFA500',
        description: `### ⚠️ Avertissement\n📝 **Raison :** ${reason}\n👤 **Par :** ${moderatorTag}\n📅 **Date :** <t:${nowTs}:F>`
      });
    },
    mute: ({ guild, reason, moderatorTag, humanDuration, expiresTs }) => {
      return createEmbed({
        color: '#FF0000',
        description: `### 🔇 Mute\n📝 **Raison :** ${reason}\n⏱️ **Durée :** ${humanDuration}\n👤 **Par :** ${moderatorTag}\n📅 **Fin prévue :** <t:${expiresTs}:F> (<t:${expiresTs}:R>)`
      });
    },
    unmuteManual: ({ guild, revokerTag, nowTs }) => {
      return createEmbed({
        color: '#00FF00',
        description: `### 🔓 DémuteManuel\n👤 **Par :** ${revokerTag}\n📅 **Date :** <t:${nowTs}:F>`
      });
    },
    unmuteAuto: ({ guild, nowTs }) => {
      return createEmbed({
        color: '#00FF00',
        description: `### 🔓 Démute Automatique\n📅 **Fin :** <t:${nowTs}:F>`
      });
    },
    notifyModManual: ({ guild, memberTag, revokerTag, reason, humanDuration, createdTs, expiresTs }) => {
      return createEmbed({
        color: '#FFD700',
        description: `### 🔔 Unmute Manuel\n👤 **Membre :** ${memberTag}\n🛠️ **Type :** Unmute Manuel\n👤 **Par :** ${revokerTag}\n📝 **Raison initiale :** ${reason}\n⏱️ **Mute posé :** <t:${createdTs}:F> — **Durée :** ${humanDuration} — **Fin prévue :** <t:${expiresTs}:F>\n✅ **Statut final :** Unmute`
      });
    },
    notifyModAuto: ({ guild, memberTag, reason, humanDuration, createdTs, expiresTs }) => {
      return createEmbed({
        color: '#FFD700',
        description: `### 🔔 Unmute Automatique\n👤 **Membre :** ${memberTag}\n🛠️ **Type :** Unmute automatique (expiration)\n📝 **Raison initiale :** ${reason}\n⏱️ **Début :** <t:${createdTs}:F> — **Durée :** ${humanDuration} — **Fin :** <t:${expiresTs}:F>\n✅ **Statut final :** Fini`
      });
    }
  };
}