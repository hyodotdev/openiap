import {
  ExpoOnsideMarketplaceAvailabilityModule,
  type InstalledFromOnside,
} from './ExpoOnsideMarketplaceAvailabilityModule';
import {useEffect, useState} from 'react';

let installedFromOnside: InstalledFromOnside = null;

/**
 * Detects an Onside marketplace install so the payment module can switch at runtime.
 *
 * Call it before initializing useIAP, for example during SplashScreen initialization:
 * the check is asynchronous and cannot run at module import, and useIAP must be
 * referenced only after it to use the correct platform.
 *
 * Enable the Onside module in your Expo config plugin:
 *
 *    plugins: [
 *      [
 *        'expo-iap',
 *        {
 *          modules: {
 *            onside: true,
 *            //Keep other modules
 *          },
 *        },
 *      ],
 *    ];
 *
 * Without it, the Onside integration is not linked and the check always returns false.
 */
async function checkInstallationFromOnside(): Promise<InstalledFromOnside> {
  const onsideInstallation =
    await ExpoOnsideMarketplaceAvailabilityModule.checkInstallationFromOnsideAsync();
  installedFromOnside = onsideInstallation;
  return onsideInstallation;
}

function useOnside() {
  const [isOnsideLoading, setIsOnsideLoading] = useState(true);

  useEffect(() => {
    checkInstallationFromOnside()
      .then((result) => {
        installedFromOnside = result;
      })
      .finally(() => {
        setIsOnsideLoading(false);
      });
  }, []);

  return {isOnsideLoading};
}

export {checkInstallationFromOnside, installedFromOnside, useOnside};
