"use strict";
// declare variables for easy access to often-used long-named variables
let Service, Characteristic;
//Constants
const { BlueriiotAPI } = require('./blueriiot-api.js');
//variables
var api = new BlueriiotAPI();


module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  //Register Homebridge Accessory
  homebridge.registerAccessory("homebridge-blueconnect", "BlueRiiot", BlueConnect);
}

class BlueConnect {

  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.homebridge = api;
    this.model = this.config.swimmingpoolid || "N/A";
    this.serial = this.config.bluedeviceserial || "N/A";
    this.manufacturer = "Blue Riiot";

    this.log.info('CONFIG: Swimming Pool ID ' + this.config.swimmingpoolid);
    this.log.info('CONFIG: Blue Device Serial ' + this.config.bluedeviceserial);

    this.informationService = new Service.AccessoryInformation();
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serial);

    this.temperatureService = new Service.TemperatureSensor(this.name);
    this.temperatureService.getCharacteristic(Characteristic.CurrentTemperature).onGet(this.getTemperature.bind(this));

    this.extendedService = new Service.AirQualitySensor(this.name);
    this.extendedService.getCharacteristic(Characteristic.AirQuality).onGet(this.getQuality.bind(this));
    this.extendedService.getCharacteristic(Characteristic.NitrogenDioxideDensity).onGet(this.getPH.bind(this));
    this.extendedService.getCharacteristic(Characteristic.OzoneDensity).onGet(this.getORP.bind(this));
    this.extendedService.getCharacteristic(Characteristic.SulphurDioxideDensity).onGet(this.getSalinity.bind(this));

    this.log.info('BlueRiiot accessory Created');
  }

  getServices() {
    return [
      this.informationService,
      this.temperatureService,
      this.extendedService,
    ];
  }

  async getQuality() {
    this.config.debug && this.log.info('Quality State has been called for : ' + this.model);

    return await this.getValue(-1);
  }

  async getTemperature() {
    this.config.debug && this.log.info('Temperature State has been called for : ' + this.model);

    return await this.getValue(0);
  }

  async getPH() {
    this.config.debug && this.log.info('PH State has been called for : ' + this.model);
    this.config.debug && this.log.info('PH State has been called for : ' + this.model);
    this.config.debug && this.log.info('PH State has been called for : ' + this.model);

    return await this.getValue(1) * 10.0; // as HK rounds floats...
  }

  async getORP() {
    this.config.debug && this.log.info('ORP State has been called for : ' + this.model);

    return await this.getValue(2);
  }

  async getSalinity() {
    this.config.debug && this.log.info('Salinity State has been called for : ' + this.model);

    return await this.getValue(3) * 10.0; // as HK rounds floats...
  }

  async getValue(item) {
    try {
      await api.init(this.config.email, this.config.password);

      if (!api.isAuthenticated()) {
        // Wait for init before querying Temp, waiting send back 0 degree.
        return 0;
      }

      if (!this.config.swimmingpoolid) { // Then get the Swimming Pool ID
        this.log.warn('No swimmingpool ID provided in the CONFIG, trying to get this value:');
        const data = await api.getSwimmingPools();
        const jsonParsed = JSON.parse(data);
        this.log.warn('Add in Config : "swimmingpoolid": "' + jsonParsed.data[0].swimming_pool_id + '"');
        return 0;
      }

      if (!this.config.bluedeviceserial) { // Then get the Blue Device Serial
        this.log.warn('No Blue Device Serial provided in the CONFIG, trying to get this value:');
        const data = await api.getSwimmingPoolBlueDevices(this.config.swimmingpoolid);
        const jsonParsed = JSON.parse(data);
        this.log.warn('Add in Config : "bluedeviceserial" : "' + jsonParsed.data[0].blue_device_serial + '"');
        return 0;
      }

      const data = await api.getLastMeasurements(this.config.swimmingpoolid, this.config.bluedeviceserial);
      const jsonParsed = JSON.parse(data);

      if(item == -1)
      {
        const t = jsonParsed.data[0].value;
        const t_ok_min = jsonParsed.data[0].ok_min;
        const t_ok_max = jsonParsed.data[0].ok_max;
        const t_warning_min = jsonParsed.data[0].warning_low;
        const t_warning_max = jsonParsed.data[0].warning_high;

        const ph = jsonParsed.data[1].value;
        const ph_ok_min = jsonParsed.data[1].ok_min;
        const ph_ok_max = jsonParsed.data[1].ok_max;
        const ph_warning_min = jsonParsed.data[1].warning_low;
        const ph_warning_max = jsonParsed.data[1].warning_high;

        const orp = jsonParsed.data[2].value;
        const orp_ok_min = jsonParsed.data[2].ok_min;
        const orp_ok_max = jsonParsed.data[2].ok_max;
        const orp_warning_min = jsonParsed.data[2].warning_low;
        const orp_warning_max = jsonParsed.data[2].warning_high;

        const s = jsonParsed.data[3].value;
        const s_ok_min = jsonParsed.data[3].ok_min;
        const s_ok_max = jsonParsed.data[3].ok_max;
        const s_warning_min = jsonParsed.data[3].warning_low;
        const s_warning_max = jsonParsed.data[3].warning_high;

        if(t <= t_warning_min || t >= t_warning_max)          return Characteristic.AirQuality.POOR;
        if(ph <= ph_warning_min || ph >= ph_warning_max)      return Characteristic.AirQuality.POOR;
        if(orp <= orp_warning_min || orp >= orp_warning_max)  return Characteristic.AirQuality.POOR;
        if(s <= s_warning_min || s >= s_warning_max)          return Characteristic.AirQuality.POOR;

        if(t <= t_ok_min || t >= t_ok_max)          return Characteristic.AirQuality.INFERIOR;
        if(ph <= ph_ok_min || ph >= ph_ok_max)      return Characteristic.AirQuality.INFERIOR;
        if(orp <= orp_ok_min || orp >= orp_ok_max)  return Characteristic.AirQuality.INFERIOR;
        if(s <= s_ok_min || s >= s_ok_max)          return Characteristic.AirQuality.INFERIOR;

        if(t >= 29 && t <= 31 && ph == 7.2)         return Characteristic.AirQuality.EXCELLENT

        return Characteristic.AirQuality.GOOD
      }
      else
      {
        this.config.debug && this.log.info("State (" + item + "): " + jsonParsed.data[item].name + ' : ' + jsonParsed.data[item].value);
        return jsonParsed.data[item].value;
      }

    } catch (error) {
      this.log.error("We have issues signing in: " + error);
      return 0;
    }
  }
}
