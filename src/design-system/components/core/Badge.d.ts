export interface BadgeProps {
  tone?: "neutral" | "success" | "warning" | "error" | "info";
  children: React.ReactNode;
}
export declare function Badge(props: BadgeProps): JSX.Element;
