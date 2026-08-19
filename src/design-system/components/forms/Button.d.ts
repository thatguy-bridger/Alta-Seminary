/**
 * @startingPoint section="Components" subtitle="Primary, secondary, outline, and ghost buttons" viewport="700x260"
 */
export interface ButtonProps {
  /** Visual style. @default "primary" */
  variant?: "primary" | "secondary" | "outline" | "ghost";
  /** Size. @default "md" */
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  /** Optional leading icon element. */
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}
export declare function Button(props: ButtonProps): JSX.Element;
