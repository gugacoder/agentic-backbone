import { createWhatsappSendTextTool } from "./whatsapp-send-text.js";
import { createWhatsappSendMediaTool } from "./whatsapp-send-media.js";
import { createWhatsappSendAudioTool } from "./whatsapp-send-audio.js";
import { createWhatsappSendLocationTool } from "./whatsapp-send-location.js";
import { createWhatsappSendContactTool } from "./whatsapp-send-contact.js";
import { createWhatsappSendReactionTool } from "./whatsapp-send-reaction.js";
import { createWhatsappSendPollTool } from "./whatsapp-send-poll.js";
import { createWhatsappSendStickerTool } from "./whatsapp-send-sticker.js";
import { createWhatsappSendListTool } from "./whatsapp-send-list.js";
import { createWhatsappSendButtonsTool } from "./whatsapp-send-buttons.js";
import { createWhatsappCheckNumbersTool } from "./whatsapp-check-numbers.js";
import { createWhatsappMarkAsReadTool } from "./whatsapp-mark-as-read.js";
import { createWhatsappArchiveChatTool } from "./whatsapp-archive-chat.js";
import { createWhatsappDeleteMessageTool } from "./whatsapp-delete-message.js";
import { createWhatsappSendPresenceTool } from "./whatsapp-send-presence.js";
import { createWhatsappBlockContactTool } from "./whatsapp-block-contact.js";
import { createWhatsappFindContactsTool } from "./whatsapp-find-contacts.js";
import { createWhatsappFindMessagesTool } from "./whatsapp-find-messages.js";
import { createWhatsappFindChatsTool } from "./whatsapp-find-chats.js";
import { createWhatsappFetchProfileTool } from "./whatsapp-fetch-profile.js";
import { createWhatsappCreateGroupTool } from "./whatsapp-create-group.js";
import { createWhatsappListGroupsTool } from "./whatsapp-list-groups.js";
import { createWhatsappGroupInfoTool } from "./whatsapp-group-info.js";
import { createWhatsappGroupParticipantsTool } from "./whatsapp-group-participants.js";
import { createWhatsappGroupInviteCodeTool } from "./whatsapp-group-invite-code.js";
import { createWhatsappGroupSendInviteTool } from "./whatsapp-group-send-invite.js";
import { createWhatsappGroupUpdateParticipantTool } from "./whatsapp-group-update-participant.js";
import { createWhatsappGroupUpdateSettingTool } from "./whatsapp-group-update-setting.js";
import { createWhatsappGroupUpdateSubjectTool } from "./whatsapp-group-update-subject.js";
import { createWhatsappGroupUpdateDescriptionTool } from "./whatsapp-group-update-description.js";
import { createWhatsappLeaveGroupTool } from "./whatsapp-leave-group.js";
import { createWhatsappListLabelsTool } from "./whatsapp-list-labels.js";
import { createWhatsappHandleLabelTool } from "./whatsapp-handle-label.js";
import { createWhatsappConnectionStateTool } from "./whatsapp-connection-state.js";
import { createWhatsappListInstancesTool } from "./whatsapp-list-instances.js";
import { createEvolutionApiTool } from "./evolution-api.js";

export function createEvolutionTools(slugs: [string, ...string[]]): Record<string, any> {
  return {
    // Mensagens (10)
    ...createWhatsappSendTextTool(slugs),
    ...createWhatsappSendMediaTool(slugs),
    ...createWhatsappSendAudioTool(slugs),
    ...createWhatsappSendLocationTool(slugs),
    ...createWhatsappSendContactTool(slugs),
    ...createWhatsappSendReactionTool(slugs),
    ...createWhatsappSendPollTool(slugs),
    ...createWhatsappSendStickerTool(slugs),
    ...createWhatsappSendListTool(slugs),
    ...createWhatsappSendButtonsTool(slugs),
    // Chat (10)
    ...createWhatsappCheckNumbersTool(slugs),
    ...createWhatsappMarkAsReadTool(slugs),
    ...createWhatsappArchiveChatTool(slugs),
    ...createWhatsappDeleteMessageTool(slugs),
    ...createWhatsappSendPresenceTool(slugs),
    ...createWhatsappBlockContactTool(slugs),
    ...createWhatsappFindContactsTool(slugs),
    ...createWhatsappFindMessagesTool(slugs),
    ...createWhatsappFindChatsTool(slugs),
    ...createWhatsappFetchProfileTool(slugs),
    // Grupos (11)
    ...createWhatsappCreateGroupTool(slugs),
    ...createWhatsappListGroupsTool(slugs),
    ...createWhatsappGroupInfoTool(slugs),
    ...createWhatsappGroupParticipantsTool(slugs),
    ...createWhatsappGroupInviteCodeTool(slugs),
    ...createWhatsappGroupSendInviteTool(slugs),
    ...createWhatsappGroupUpdateParticipantTool(slugs),
    ...createWhatsappGroupUpdateSettingTool(slugs),
    ...createWhatsappGroupUpdateSubjectTool(slugs),
    ...createWhatsappGroupUpdateDescriptionTool(slugs),
    ...createWhatsappLeaveGroupTool(slugs),
    // Labels (2)
    ...createWhatsappListLabelsTool(slugs),
    ...createWhatsappHandleLabelTool(slugs),
    // Instancias (2)
    ...createWhatsappConnectionStateTool(slugs),
    ...createWhatsappListInstancesTool(slugs),
    // Fallback generico (1)
    ...createEvolutionApiTool(slugs),
  };
}
