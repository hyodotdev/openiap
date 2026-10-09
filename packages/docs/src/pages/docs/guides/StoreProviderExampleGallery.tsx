import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { screens, type ExampleScreen } from './StoreProviderExampleData';

function ScreenPreview({ screen }: { screen: ExampleScreen }) {
  const wideNote =
    'wideImage' in screen
      ? ' The wide app layout was checked with a temporary display-density override; original device settings were restored.'
      : '';
  return (
    <figure>
      <picture>
        {'wideImage' in screen ? (
          <source
            media="(min-width: 768px)"
            srcSet={`/store-provider-example/${screen.wideImage}`}
          />
        ) : null}
        <img
          src={`/store-provider-example/${screen.image}`}
          alt={`Amazon Community Example on a Fire tablet: ${screen.title}`}
          width="800"
          height="1280"
          loading="lazy"
        />
      </picture>
      <figcaption>
        {screen.detail} Actual Fire tablet capture. App Tester simulates
        checkout.{wideNote}
      </figcaption>
    </figure>
  );
}

function DesktopGallery() {
  const [selected, setSelected] = useState<ExampleScreen>(screens[0]);
  return (
    <div className="provider-example-showcase provider-example-desktop">
      <div
        className="provider-example-screen-picker"
        aria-label="Example app screens"
      >
        {screens.map((screen, index) => (
          <button
            key={screen.id}
            type="button"
            aria-pressed={selected.id === screen.id}
            onClick={() => setSelected(screen)}
          >
            <span>0{index + 1}</span>
            <strong>{screen.title}</strong>
            <small>{screen.detail}</small>
          </button>
        ))}
      </div>
      <ScreenPreview screen={selected} />
    </div>
  );
}

function MobileGallery() {
  return (
    <div className="provider-example-mobile" aria-label="Example app screens">
      {screens.map((screen, index) => (
        <details key={screen.id} name="provider-example-screens">
          <summary>
            <span className="provider-example-step">0{index + 1}</span>
            <strong>{screen.title}</strong>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <ScreenPreview screen={screen} />
        </details>
      ))}
    </div>
  );
}

export default function StoreProviderExampleGallery() {
  return (
    <>
      <DesktopGallery />
      <MobileGallery />
    </>
  );
}
