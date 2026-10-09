import { Field, Flex, SingleSelect, SingleSelectOption } from '@strapi/design-system';
import { useEffect, useState } from 'react';

import { type CollectionType, type Locale, type PublicationStatus, useApi } from '../api';

export interface Source {
  uid: string;
  locale?: string;
  status: PublicationStatus;
}

interface Props {
  contentTypes: CollectionType[];
  value: Source;
  onChange: (source: Source) => void;
  statusLabel: string;
}

/** Collection, locale (localized types only) and draft/published (Draft and Publish types only). */
export const SourcePicker = ({ contentTypes, value, onChange, statusLabel }: Props) => {
  const api = useApi();
  const [locales, setLocales] = useState<Locale[]>([]);
  const selected = contentTypes.find((ct) => ct.uid === value.uid);

  const localized = selected?.localized === true;

  useEffect(() => {
    if (localized && locales.length === 0) api.locales().then(setLocales);
  }, [api, localized, locales.length]);

  // Default to the default locale once locales are known; stops as soon as a locale is set.
  useEffect(() => {
    if (localized && !value.locale && locales.length > 0) {
      onChange({ ...value, locale: locales.find((l) => l.isDefault)?.code ?? locales[0].code });
    }
  }, [localized, locales, value, onChange]);

  return (
    <Flex gap={4} alignItems="flex-start">
      <Field.Root name="collection" required>
        <Field.Label>Collection</Field.Label>
        <SingleSelect
          placeholder="Choose a collection"
          value={value.uid}
          onChange={(uid: string | number) => onChange({ ...value, uid: String(uid) })}
        >
          {contentTypes.map((ct) => (
            <SingleSelectOption key={ct.uid} value={ct.uid}>
              {ct.displayName}
            </SingleSelectOption>
          ))}
        </SingleSelect>
      </Field.Root>
      {localized && (
        <Field.Root name="locale">
          <Field.Label>Locale</Field.Label>
          <SingleSelect value={value.locale} onChange={(locale: string | number) => onChange({ ...value, locale: String(locale) })}>
            {locales.map((locale) => (
              <SingleSelectOption key={locale.code} value={locale.code}>
                {locale.name}
              </SingleSelectOption>
            ))}
          </SingleSelect>
        </Field.Root>
      )}
      {selected?.draftAndPublish && (
        <Field.Root name="status">
          <Field.Label>{statusLabel}</Field.Label>
          <SingleSelect
            value={value.status}
            onChange={(status: string | number) => onChange({ ...value, status: status as PublicationStatus })}
          >
            <SingleSelectOption value="draft">Draft</SingleSelectOption>
            <SingleSelectOption value="published">Published</SingleSelectOption>
          </SingleSelect>
        </Field.Root>
      )}
    </Flex>
  );
};
