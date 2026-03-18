import * as React from "react"

function Label(props: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className="text-sm font-medium leading-none" {...props} />
}

export { Label }