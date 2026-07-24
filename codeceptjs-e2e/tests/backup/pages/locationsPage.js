const { storageLocationConnection } = require('./testData');

const { I, locationsAPI } = inject();

const locationCell = (name) => `//tr[td[contains(text(), "${name}")]]`;

module.exports = {
  storageLocationConnection,
  url: 'graph/backup/locations',
  columnHeaders: ['Name', 'Source', 'Created', 'Actions'],
  elements: {
    noData: '$table-no-data',
    modalHeader: '$modal-header',
    nameFieldLabel: '$name-field-label',
    descriptionFieldLabel: '$description-field-label',
    endpointFieldLabel: '$endpoint-field-label',
    bucketFieldLabel: '$bucketName-field-label',
    accessKeyFieldLabel: '$accessKey-field-label',
    secretKeyFieldLabel: '$secretKey-field-label',
    typeFieldLabel: '$type-field-label',
    validation: {
      nameFieldValidation: '$name-field-error-message',
      endpointFieldValidation: '$endpoint-field-error-message',
      bucketFieldValidation: '$bucketName-field-error-message',
      accessKeyFieldValidation: '$accessKey-field-error-message',
      secretKeyFieldValidation: '$secretKey-field-error-message',
    },
    typeCellByName: (name) => locate('//td[2]').inside(locationCell(name)),
    endpointCellByName: (name) => locate('//td[3]').inside(locationCell(name)),
    locationDetails: {
      description: locate('$storage-location-description').find('pre'),
      bucket: locate('$storage-location-bucket').find('span').at(2),
      accessKey: '$access-key',
      secretKey: '$small-secret-holder',
    },
    confirmDelete: locate('$modal-content').find('h4'),
    deleteWarning: '$warning-block',
    columnHeaderLocator: (columnHeaderText) => `//th[text()="${columnHeaderText}"]`,
  },
  buttons: {
    openAddLocationModal: '$storage-location-add-modal-button',
    addLocation: '$storage-location-add-button',
    testLocation: '$storage-location-test-button',
    cancel: '$storage-location-cancel-button',
    closeModal: '$modal-close-button',
    typeSelect: (locationType) => `//label[text()="${locationType}"]/preceding-sibling::input[1]`,
    actionsMenuByName: (name) => locate('$dropdown-menu-toggle').inside(locationCell(name)),
    // editByName returns Edit storage location button locator for a given Location name
    editByName: (name) => locate('$edit-storage-location-button').inside(locationCell(name)),
    // deleteByName returns Delete storage location button locator for a given Location name
    deleteByName: (name) => locate('$delete-storage-location-button').inside(locationCell(name)),
    showDetails: (name) => locate('$show-row-details').inside(locationCell(name)),
    hideDetails: (name) => locate('$hide-row-details').inside(locationCell(name)),
    showSecret: locate('[class$="-Icon"]').after('$small-secret-holder'),
    forceDeleteCheckbox: '$force-checkbox-input',
    cancelDelete: '$cancel-delete-modal-button',
    confirmDelete: '$confirm-delete-modal-button',
  },
  fields: {
    name: '$name-text-input',
    description: '$description-textarea-input',
    endpoint: '$endpoint-text-input',
    bucket: '$bucketName-text-input',
    accessKey: '$accessKey-text-input',
    secretKey: '$secretKey-text-input',
    path: '$client-text-input',
  },
  messages: {
    noLocations: 'No storage locations found',
    modalHeaderText: 'Add Storage Location',
    deleteModalHeaderText: 'Delete Storage Location',
    confirmDelete: (name) => `Are you sure you want to delete the Storage Location "${name}"?`,
    editModalHeaderText: (name) => `Edit "${name}" Storage Location`,
    successfullyAdded: 'Backup location was successfully added',
    successfullyTested: 'This storage location is valid',
    successfullyEdited: (name) => `Backup location "${name}" was successfully updated`,
    successfullyDeleted: (name) => `Backup location "${name}" successfully deleted.`,
    requiredField: 'Required field',
    locationAlreadyExists: (name) => `Location with name "${name}" already exists.`,
    locationHasArtifacts: (location_id) => `backup location with ID "${location_id}" has artifacts.`,
    deleteWarning: 'This action will only remove the Storage Location from PMM inventory, but will not delete the physical storage.',
  },
  locationType: {
    s3: 'S3',
    client: 'Local Client',
    server: 'Local Server',
  },

  openLocationsPage() {
    I.amOnPage(this.url);
    I.waitForText('Add', 30, this.buttons.openAddLocationModal);
  },

  openAddLocationModal() {
    I.click(this.buttons.openAddLocationModal);
    I.waitForVisible(this.elements.nameFieldLabel, 30);

    I.seeTextEquals(this.messages.modalHeaderText, this.elements.modalHeader);
    I.seeElement(this.buttons.closeModal);
  },

  openDeleteLocationModal(locationName) {
    I.waitForVisible(this.buttons.actionsMenuByName(locationName), 10);
    I.click(this.buttons.actionsMenuByName(locationName));
    I.waitForVisible(this.buttons.deleteByName(locationName), 2);
    I.click(this.buttons.deleteByName(locationName));
    I.waitForVisible(this.buttons.forceDeleteCheckbox, 10);
  },

  fillLocationFields(name, type, config, desc = '') {
    const {
      path, endpoint, bucket_name, access_key, secret_key,
    } = config;

    I.fillField(this.fields.name, name);
    I.fillField(this.fields.description, desc);

    if (type === locationsAPI.storageType.s3) {
      I.fillField(this.fields.endpoint, endpoint);
      I.fillField(this.fields.bucket, bucket_name);
      I.fillField(this.fields.accessKey, access_key);
      I.fillField(this.fields.secretKey, secret_key);
    } else {
      I.click(this.buttons.typeSelect(this.locationType.client));
      I.fillField(this.fields.path, path);
    }
  },

  verifyLocationFields(name, type, config, description = '') {
    const {
      endpoint, bucket_name, access_key, secret_key,
    } = config;

    I.waitForVisible(this.fields.name, 30);
    I.seeInField(this.fields.name, name);
    I.seeInField(this.fields.description, description);
    I.seeInField(this.fields.endpoint, endpoint);
    I.seeInField(this.fields.bucket, bucket_name);
    I.seeInField(this.fields.accessKey, access_key);
    I.seeAttributesOnElements(this.fields.secretKey, { type: 'password', value: secret_key });
  },
};
