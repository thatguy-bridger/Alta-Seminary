/**
 * @startingPoint section="Components" subtitle="Bordered surface with soft shadow for grouped content" viewport="700x260"
 */
export interface CardProps {
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}
export declare function Card(props: CardProps): JSX.Element;
