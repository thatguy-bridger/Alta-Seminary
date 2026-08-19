export interface ToastProps {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "error";
}
export declare function Toast(props: ToastProps): JSX.Element;
