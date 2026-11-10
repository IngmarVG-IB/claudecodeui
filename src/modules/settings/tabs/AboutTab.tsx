import { ExternalLink, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { APP_VERSION, CLOUDCLI_WORDMARK_FONT_FAMILY } from '@/shared/constants';
import { SANDLOT_SOURCE_URL } from '@/shared/sandlotLinks';

/**
 * Rendered by Settings for the "about" tab: version, the source link the AGPL
 * requires, and the licence. The Sandlot build makes no network calls of its
 * own, so there is no update check here; the image pins the version.
 */
export default function AboutTab() {
  const { t } = useTranslation('settings');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/90 shadow-sm">
          <MessageSquare className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span
              className="text-base font-semibold text-foreground"
              style={{ fontFamily: CLOUDCLI_WORDMARK_FONT_FAMILY }}
            >
              CloudCLI
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              v{APP_VERSION} (Sandlot build)
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t('about.tagline')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <a
          href={SANDLOT_SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Source code (AGPL-3.0)
        </a>
      </div>

      <div className="border-t border-border/50 pt-4">
        <p className="text-xs text-muted-foreground/60">
          {t('about.licensed')}
        </p>
      </div>
    </div>
  );
}
