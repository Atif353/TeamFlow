import { useState } from 'react'
import { toast } from 'sonner'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { useUpdateWorkflow } from '../hooks/useProjects'
import type { Project } from '../types'

type Rules = Record<string, string[] | null>

function toRules(project: Project): Rules {
  return Object.fromEntries(
    project.statuses.map((status) => [status.id, project.transitions[status.id] ?? null]),
  )
}

export function WorkflowEditor({ project }: { project: Project }) {
  const [rules, setRules] = useState<Rules>(() => toRules(project))
  const save = useUpdateWorkflow(project.id)
  const statuses = [...project.statuses].sort((a, b) => a.order - b.order)

  const toggleRestriction = (sourceId: string, restricted: boolean) =>
    setRules((current) => ({
      ...current,
      [sourceId]: restricted ? statuses.filter((s) => s.id !== sourceId).map((s) => s.id) : null,
    }))

  const toggleTarget = (sourceId: string, targetId: string, allowed: boolean) =>
    setRules((current) => {
      const targets = current[sourceId] ?? []
      return {
        ...current,
        [sourceId]: allowed ? [...targets, targetId] : targets.filter((id) => id !== targetId),
      }
    })

  const onSave = () => {
    const transitions = Object.fromEntries(
      Object.entries(rules).filter((entry): entry is [string, string[]] => entry[1] !== null),
    )
    save.mutate(transitions, { onSuccess: () => toast.success('Workflow saved') })
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {statuses.map((source) => {
          const targets = rules[source.id] ?? null
          return (
            <li key={source.id} className="flex flex-col gap-3 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm">
                  From <StatusPill name={source.name} color={source.color} />
                </span>
                <Checkbox
                  label={`Limit where issues in ${source.name} can go`}
                  checked={targets !== null}
                  onChange={(event) => toggleRestriction(source.id, event.target.checked)}
                />
              </div>
              {targets === null ? (
                <p className="text-xs text-muted-foreground">Issues can move to any status.</p>
              ) : (
                <div
                  role="group"
                  aria-label={`Allowed targets from ${source.name}`}
                  className="flex flex-wrap gap-x-5 gap-y-1"
                >
                  {statuses
                    .filter((target) => target.id !== source.id)
                    .map((target) => (
                      <Checkbox
                        key={target.id}
                        label={target.name}
                        checked={targets.includes(target.id)}
                        onChange={(event) =>
                          toggleTarget(source.id, target.id, event.target.checked)
                        }
                      />
                    ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <div className="flex gap-2">
        <Button onClick={onSave} loading={save.isPending}>
          Save workflow
        </Button>
        <Button variant="ghost" onClick={() => setRules(toRules(project))}>
          Reset
        </Button>
      </div>
    </div>
  )
}
