import React from 'react';
import { RichText } from './richText.jsx';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { EditableImage } from '../admin-app/builder/EditableImage.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';

export function ColumnsBlock({ editable, onFieldChange, pathPrefix, textAlign = 'left', widthRatio = 'equal', divider = false, ...props }) {
  const count = props.columnCount === '3' ? 3 : 2;
  const columns = [
    { imageKey: 'col1Image', headingKey: 'col1Heading', bodyKey: 'col1Body', image: props.col1Image, heading: props.col1Heading, body: props.col1Body, headingStyle: props.col1HeadingStyle, bodyStyle: props.col1BodyStyle },
    { imageKey: 'col2Image', headingKey: 'col2Heading', bodyKey: 'col2Body', image: props.col2Image, heading: props.col2Heading, body: props.col2Body, headingStyle: props.col2HeadingStyle, bodyStyle: props.col2BodyStyle },
    { imageKey: 'col3Image', headingKey: 'col3Heading', bodyKey: 'col3Body', image: props.col3Image, heading: props.col3Heading, body: props.col3Body, headingStyle: props.col3HeadingStyle, bodyStyle: props.col3BodyStyle },
  ].slice(0, count);

  return (
    <div className="block-columns" data-count={count} data-ratio={count === 2 ? widthRatio : 'equal'} data-divider={divider} style={{ textAlign }}>
      {columns.map((col, i) => (
        <div key={i}>
          {(editable || col.image) && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              {editable ? (
                <EditableImage value={col.image} alt="" onChange={(url) => onFieldChange(col.imageKey, url)} pathPrefix={pathPrefix} emptyLabel={`Slide ${i + 1} image (optional)`} />
              ) : (
                <img src={col.image} alt="" style={{ width: '100%', borderRadius: 'var(--radius-md)' }} />
              )}
            </div>
          )}
          {(editable || col.heading) && (
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-subheading)', margin: '0 0 var(--space-2)', color: 'var(--text-primary)', ...textStyleToCss(col.headingStyle) }}>
              {editable ? (
                <EditableText value={col.heading} onCommit={(v) => onFieldChange(col.headingKey, v)} placeholder={`Column ${i + 1} heading`} styleValue={col.headingStyle} onStyleChange={(s) => onFieldChange(`${col.headingKey}Style`, s)} />
              ) : col.heading}
            </h3>
          )}
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', ...textStyleToCss(col.bodyStyle) }}>
            {editable ? (
              <EditableText value={col.body} onCommit={(v) => onFieldChange(col.bodyKey, v)} placeholder={`Column ${i + 1} body`} multiline as="div" styleValue={col.bodyStyle} onStyleChange={(s) => onFieldChange(`${col.bodyKey}Style`, s)} />
            ) : (
              <RichText text={col.body} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
