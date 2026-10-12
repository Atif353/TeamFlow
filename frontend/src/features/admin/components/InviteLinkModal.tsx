import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { formatDate } from '@/lib/formatters'
import type { InvitationCreated } from '../types'

interface InviteLinkModalProps {
  invitation: InvitationCreated | null
  onClose: () => void
}

export function InviteLinkModal({ invitation, onClose }: InviteLinkModalProps) {
  const copy = async () => {
    if (!invitation) return
    try {
      await navigator.clipboard.writeText(invitation.invite_url)
      toast.success('Invitation link copied')
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.')
    }
  }

  return (
    <Modal
      open={invitation !== null}
      onClose={onClose}
      title="Invitation link"
      description={
        invitation
          ? `Share this single-use link with ${invitation.email}. It expires on ${formatDate(invitation.expires_at)}.`
          : undefined
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
          <Button onClick={() => void copy()}>
            <Copy size={16} aria-hidden="true" /> Copy link
          </Button>
        </>
      }
    >
      <Input
        label="Invite link"
        readOnly
        value={invitation?.invite_url ?? ''}
        onFocus={(event) => event.target.select()}
        hint="For security, the link is only shown once. Use Resend to generate a new one."
      />
    </Modal>
  )
}
