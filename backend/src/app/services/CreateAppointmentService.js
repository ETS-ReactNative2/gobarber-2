import { format, startOfHour, parseISO, isBefore } from 'date-fns';
import en from 'date-fns/locale/en-US';

import User from '../models/User';
import Appointment from '../models/Appointment';
import Notification from '../schemas/Notification';

import Cache from '../../lib/Cache';

class CreateAppointmentService {
  async run({ provider_id, user_id, date }) {
    /**
     * Check if user is setting an appointment with himself
     */

    if (provider_id === user_id) {
      throw new Error('You cannot create an appointment with yourself.');
    }

    /**
     * Check if provider_id is a provider
     */
    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!isProvider) {
      throw new Error('You can only create appointments with providers.');
    }

    /**
     * Check for past dates
     */
    const hourStart = startOfHour(parseISO(date));

    if (isBefore(hourStart, new Date())) {
      throw new Error('Past dates are not allowed.');
    }

    /**
     * Check for provider availability
     */

    const checkAvailability = await Appointment.findOne({
      where: { provider_id, canceled_at: null, date: hourStart },
    });

    if (checkAvailability) {
      throw new Error('Appointment date is not available.');
    }

    const appointment = await Appointment.create({
      user_id,
      provider_id,
      date,
    });

    /**
     * Notify appointment provider
     */
    const user = await User.findByPk(user_id);
    const formattedDate = format(hourStart, "MMMM do', at' p", {
      locale: en,
    });

    await Notification.create({
      content: `New appointment with ${user.name} on ${formattedDate}`,
      user: provider_id,
    });

    /**
     * Invalidate cache
     */
    await Cache.invalidatePrefix(`user:${user_id}:appointments`);

    return appointment;
  }
}

export default new CreateAppointmentService();
