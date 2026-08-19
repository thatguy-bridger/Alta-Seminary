export interface RadioProps {
  label: string;
  name: string;
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
export declare function Radio(props: RadioProps): JSX.Element;
