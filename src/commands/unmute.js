import { SlashCommandBuilder } from 'discord.js';
import { sanctions, getGuildSettings } from '../db.js';
import { getTier, isHigherRole, ensureBotCanManageRole, canUseStaffCommands } from '../utils/permissions.js';
import { sendLog } from '../utils/logs.js';
import { safeDM, dmTemplates, humanizeMs, ts } from '../utils/dm.js';
import { clearMuteTimer } from '../services/scheduler.js';
import { createErrorEmbed, createInfoEmbed, createEmbed } from '../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('unmute')
  .setDescription('Démuter un membre')
  .addUserOption(o => o.setName('membre').setDescription('Membre à démute').setRequired(true));

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      embeds: [createErrorEmbed('Cette commande ne peut être utilisée qu\'en serveur.')],
      ephemeral: true
    });
  }

  const guild   = interaction.guild;
  const guildId = guild.id;

  // ➜ Doit être lancé dans le salon de sanctions
  const gs = getGuildSettings(guildId);
  const sanctionChannel = gs.sanction_channel_id ? guild.channels.cache.get(gs.sanction_channel_id) : null;
  if (sanctionChannel && interaction.channelId !== sanctionChannel.id) {
    return interaction.reply({
      embeds: [createErrorEmbed(`Utilise cette commande dans ${sanctionChannel}.`)],
      ephemeral: true
    });
  }

  // ➜ “Staff” = voit le salon (ou OwnerMute/SYS+)
  if (!canUseStaffCommands(guildId, interaction.member)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Accès refusé')],
      ephemeral: true
    });
  }

  // ✅ ACK pour éviter “Application ne répond plus”
  await interaction.deferReply({ ephemeral: true });

  const me = guild.members.me;
  const target = interaction.options.getMember('membre', true);

  if (!gs.logs_channel_id) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Configure le salon de logs avec `/config logs`.')]
    });
  }
  if (!gs.mute_role_id) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Configure le rôle **Muted** avec `/configmute role`.')]
    });
  }

  const actorTier = getTier(guildId, interaction.member);
  if (!isHigherRole(interaction.member, target) && !['SYS+','OWNERMUTE'].includes(actorTier)) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Tu ne peux pas agir sur ce membre (hiérarchie).')]
    });
  }

  const manageCheck = ensureBotCanManageRole(guild, gs.mute_role_id, me);
  if (!manageCheck.ok) {
    return interaction.editReply({
      embeds: [createErrorEmbed(manageCheck.reason)]
    });
  }

  const active = sanctions.getLatestActiveMuteByUser(guildId, target.id);
  if (!active) {
    return interaction.editReply({
      embeds: [createInfoEmbed(`${target} n'a pas de mute actif.`)]
    });
  }

  const canBypass = ['SYS+','OWNERMUTE','GESTION'].includes(actorTier);
  if (!canBypass && active.moderator_id !== interaction.user.id) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Tu ne peux pas unmute un mute que tu n\'as pas posé.')]
    });
  }

  // 🔹 Suppression du rôle mute
  const role = guild.roles.cache.get(gs.mute_role_id);
  if (role && target.roles.cache.has(role.id)) {
    await target.roles.remove(role.id).catch(() => {});
  }

  // 🔹 Déplacement vocal aléatoire si en vocal
  if (target.voice && target.voice.channel) {
    const originalChannel = target.voice.channel;
    const voiceChannels = guild.channels.cache.filter(c => 
      c.isVoiceBased() && c.id !== originalChannel.id
    );

    if (voiceChannels.size > 0) {
      const randomChannel = voiceChannels.random();
      try {
        // Étape 1 : Déplacer dans un vocal aléatoire
        await target.voice.setChannel(randomChannel);

        // Pause courte
        await new Promise(res => setTimeout(res, 1500));

        // Étape 2 : Remettre dans le vocal d'origine
        await target.voice.setChannel(originalChannel);
      } catch (err) {
        console.error(`Erreur lors du déplacement vocal unmute pour ${target.user.tag}:`, err);
      }
    }
  }

  // 🔹 Marquer la sanction comme révoquée
  sanctions.setRevoked(active.id, interaction.user.id);
  clearMuteTimer(active.id);

  // 🔹 Notifs DM
  const templates = dmTemplates();
  await safeDM(target.user, templates.unmuteManual({ guild: guild.name, revokerTag: interaction.user.tag, nowTs: ts(Date.now()) }));
  const modUser = await interaction.client.users.fetch(active.moderator_id).catch(() => null);
  if (modUser) {
    await safeDM(modUser, templates.notifyModManual({
      guild: guild.name,
      memberTag: target.user.tag,
      revokerTag: interaction.user.tag,
      reason: active.reason || '—',
      humanDuration: humanizeMs(active.duration_ms || 0),
      createdTs: ts(active.created_at),
      expiresTs: ts(active.created_at + (active.duration_ms || 0))
    }));
  }

  // 🔹 Logs
  await sendLog(guild, (e) => {
    return createEmbed({
      title: '🔇 Unmute Manuel',
      color: '#00FF00',
      fields: [
        { name: '👤 Démuté par',       value: `${interaction.user}`, inline: true },
        { name: '👥 Membre',           value: `${target}`,           inline: true },
        { name: '🆔 Sanction ID',      value: String(active.id),     inline: true },
        { name: '🛡️ Mute initial par', value: modUser ? `${modUser}` : '`Inconnu`', inline: true },
        { name: '📝 Raison initiale',  value: active.reason || '—',  inline: false }
      ],
      footer: { text: `Unmute effectué le ${new Date().toLocaleString("fr-FR")}` }
    });
  }).catch(() => {});

  // 🔹 Message neutre pour fermer l'éphemère
  await interaction.editReply({
    embeds: [createInfoEmbed(`✅ ${target.user.tag} a bien été démute.`)]
  });

  // 🔹 Embed final en public
  return interaction.followUp({
    ephemeral: false,
    embeds: [
      createEmbed({
        title: '✅ Démute effectué',
        color: '#00FF00',
        fields: [
          { name: '👤 Démuté par',       value: `${interaction.user}`, inline: true },
          { name: '👥 Membre',           value: `${target}`,           inline: true },
          { name: '🆔 Sanction ID',      value: String(active.id),     inline: true },
          { name: '🛡️ Mute initial par', value: modUser ? `${modUser}` : '`Inconnu`', inline: true },
          { name: '📝 Raison initiale',  value: active.reason || '—',  inline: false }
        ],
        footer: { text: `Unmute effectué le ${new Date().toLocaleString("fr-FR")}` }
      })
    ]
  });
}
