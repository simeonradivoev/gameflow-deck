import classNames from "classnames";
import { CircleX, Cross, X } from "lucide-react";
import { createContext, JSX, useContext, useEffect, useState } from "react";
import toast, { ToastBar, Toaster } from "react-hot-toast";

let toasterGlobalId = 0;

const ToastersContext = createContext(
  {} as {
    showToaster: (data: Toast) => void;
  },
);

export function useToasters ()
{
  const toasters = useContext(ToastersContext);
  return { ...toasters };
}

interface Toast
{
  message: string | JSX.Element;
  type: "success" | "info" | "error" | "warning";
  duration?: number;
  icon?: JSX.Element;
}

interface ToastExtra extends Toast
{
  timeout?: NodeJS.Timeout;
  id: number;
}

function ToastComponent (data: { toast: Toast; })
{
  return (
    <div className={classNames(`alert alert-${data.toast.type} `)}>
      <span>
        {data.toast.icon}
        {data.toast.message}
      </span>
    </div>
  );
}

export function Toasters ()
{
  const [visibleToasters, setVisible] = useState<ToastExtra[]>([]);
  useEffect(() =>
  {
    return () =>
    {
      visibleToasters.filter((t) => t.timeout).forEach((t) => clearTimeout(t.timeout));
    };
  }, [setVisible]);

  return (
    <Toaster toastOptions={{
      className: "bg-base-300 text-base-content", success: {
        className: 'bg-success'
      }
    }}>
      {(t) => <ToastBar toast={t} >
        {({ icon, message }) => (
          <>
            {icon}
            {message}
            {t.type !== 'loading' && (
              <button className="size-6 p-0 rounded-full cursor-pointer text-base-100" onClick={() => toast.dismiss(t.id)}><CircleX className="size-5" /></button>
            )}
          </>
        )}
      </ToastBar>}
    </Toaster>
  );
}
