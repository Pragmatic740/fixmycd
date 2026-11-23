import { parseEthics } from '@/lib/ethics-text';

/** Renders Code of Ethics text as plain React elements (never as HTML). */
export function EthicsText({ body }: { body: string }) {
  return (
    <div className="ethics-text">
      {parseEthics(body).map((block, i) => {
        if (block.type === 'heading') return i === 0 ? <h1 key={i}>{block.text}</h1> : <h2 key={i}>{block.text}</h2>;
        if (block.type === 'list') {
          return (
            <ul key={i}>
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{block.text}</p>;
      })}
    </div>
  );
}
