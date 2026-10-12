import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState, type ComponentProps } from 'react'
import { Input } from '@/components/ui/Input'

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type' | 'leftIcon'>

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false)
    return (
      <div className="relative">
        <Input ref={ref} type={visible ? 'text' : 'password'} {...props} />
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((value) => !value)}
          className="absolute right-1 top-[26px] flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
    )
  },
)
