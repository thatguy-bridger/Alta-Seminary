export interface SwitchProps {
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
}
export declare function Switch(props: SwitchProps): JSX.Element;
